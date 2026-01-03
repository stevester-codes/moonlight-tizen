#include "moonlight_wasm.hpp"

#include <iostream>
#include <array>
#include <cstdint>
#include <utility>
#include <sstream>
#include <chrono>
#include <thread>
#include <cmath>
#include <limits>
#include <algorithm>

#include <Limelight.h>
#include <emscripten/emscripten.h>

// Bitmask for gamepad combo buttons to stop the streaming session
const short STOP_STREAM_BUTTONS = BACK_FLAG | PLAY_FLAG | LB_FLAG | RB_FLAG;

// Bitmask for gamepad combo buttons to toggle the performance stats overlay
const short PERF_STATS_BUTTONS = BACK_FLAG | LB_FLAG | RB_FLAG | X_FLAG;

// Flag for gamepad to track controller rumble state
bool rumbleFeedbackSwitch = false;

// Flags for gamepad to track mouse emulation state
bool mouseEmulationSwitch = false;
bool mouseEmulationActive = false;
static int mouseOwnerControllerNumber = -1;
static std::array<std::chrono::steady_clock::time_point, 16> mouseTogglePressTime;
static std::array<bool, 16> playHeld{};
static std::array<bool, 16> mouseToggleFired{};
static int lastActiveControllerCount = -1;

static void ReleaseAllMouseButtons() {
  LiSendMouseButtonEvent(BUTTON_ACTION_RELEASE, BUTTON_LEFT);
  LiSendMouseButtonEvent(BUTTON_ACTION_RELEASE, BUTTON_MIDDLE);
  LiSendMouseButtonEvent(BUTTON_ACTION_RELEASE, BUTTON_RIGHT);
}

// Flags for gamepad to track face buttons state
bool flipABfaceButtonsSwitch = false;
bool flipXYfaceButtonsSwitch = false;

// For explanation on ordering, see: https://www.w3.org/TR/gamepad/#remapping
// Enumeration for gamepad buttons
enum GamepadButton {
  A, B, X, Y,
  LeftBumper, RightBumper,
  LeftTrigger, RightTrigger,
  Back, Play,
  LeftStick, RightStick,
  Up, Down, Left, Right,
  Special,
  Count,
};

// For explanation on ordering, see: https://www.w3.org/TR/gamepad/#remapping
// Enumeration for gamepad axis
enum GamepadAxis {
  LeftX = 0,
  LeftY = 1,
  RightX = 2,
  RightY = 3,
};

// Function to map gamepad buttons to flags
static short GetButtonFlags(const EmscriptenGamepadEvent& gamepad) {
  // Triggers are considered analog buttons in the "Emscripten API", however they need
  // to be passed in separate arguments for "Limelight" (it even lacks flags for them).

  const int* buttonMasks = nullptr;
  int buttonMasksSize = 0;

  // Define button mapping with A/B and X/Y swapped
  static const int buttonMasksABXY[] = {
    B_FLAG, A_FLAG, Y_FLAG, X_FLAG,
    LB_FLAG, RB_FLAG,
    0 /* LT_FLAG */, 0 /* RT_FLAG */,
    BACK_FLAG, PLAY_FLAG,
    LS_CLK_FLAG, RS_CLK_FLAG,
    UP_FLAG, DOWN_FLAG, LEFT_FLAG, RIGHT_FLAG,
    SPECIAL_FLAG,
  };
  // Define button mapping with A/B swapped
  static const int buttonMasksAB[] = {
    B_FLAG, A_FLAG, X_FLAG, Y_FLAG,
    LB_FLAG, RB_FLAG,
    0 /* LT_FLAG */, 0 /* RT_FLAG */,
    BACK_FLAG, PLAY_FLAG,
    LS_CLK_FLAG, RS_CLK_FLAG,
    UP_FLAG, DOWN_FLAG, LEFT_FLAG, RIGHT_FLAG,
    SPECIAL_FLAG,
  };
  // Define button mapping with X/Y swapped
  static const int buttonMasksXY[] = {
    A_FLAG, B_FLAG, Y_FLAG, X_FLAG,
    LB_FLAG, RB_FLAG,
    0 /* LT_FLAG */, 0 /* RT_FLAG */,
    BACK_FLAG, PLAY_FLAG,
    LS_CLK_FLAG, RS_CLK_FLAG,
    UP_FLAG, DOWN_FLAG, LEFT_FLAG, RIGHT_FLAG,
    SPECIAL_FLAG,
  };
  // Define default button mapping
  static const int buttonMasksDefault[] = {
    A_FLAG, B_FLAG, X_FLAG, Y_FLAG,
    LB_FLAG, RB_FLAG,
    0 /* LT_FLAG */, 0 /* RT_FLAG */,
    BACK_FLAG, PLAY_FLAG,
    LS_CLK_FLAG, RS_CLK_FLAG,
    UP_FLAG, DOWN_FLAG, LEFT_FLAG, RIGHT_FLAG,
    SPECIAL_FLAG,
  };

  // Check if the A/B or X/Y face buttons switches are checked
  if (flipABfaceButtonsSwitch && flipXYfaceButtonsSwitch) {
    // Swap both A/B and X/Y buttons
    buttonMasks = buttonMasksABXY;
    buttonMasksSize = sizeof(buttonMasksABXY) / sizeof(buttonMasksABXY[0]);
  } else if (flipABfaceButtonsSwitch) { // Check if the A/B face buttons switch is checked
    // Swap A and B buttons
    buttonMasks = buttonMasksAB;
    buttonMasksSize = sizeof(buttonMasksAB) / sizeof(buttonMasksAB[0]);
  } else if (flipXYfaceButtonsSwitch) { // Check if the X/Y face buttons switch is checked
    // Swap X and Y buttons
    buttonMasks = buttonMasksXY;
    buttonMasksSize = sizeof(buttonMasksXY) / sizeof(buttonMasksXY[0]);
  } else {
    // Default buttons layout
    buttonMasks = buttonMasksDefault;
    buttonMasksSize = sizeof(buttonMasksDefault) / sizeof(buttonMasksDefault[0]);
  }

  short result = 0;
  
  for (int i = 0; i < gamepad.numButtons && i < buttonMasksSize; ++i) {
    if (gamepad.digitalButton[i] == EM_TRUE) {
      result |= buttonMasks[i];
    }
  }

  return result;
}

// Function to handle the gamepad input state
void MoonlightInstance::HandleGamepadInputState(bool rumbleFeedback, bool mouseEmulation, bool flipABfaceButtons, bool flipXYfaceButtons) {
  rumbleFeedbackSwitch = rumbleFeedback;
  mouseEmulationSwitch = mouseEmulation;
  flipABfaceButtonsSwitch = flipABfaceButtons;
  flipXYfaceButtonsSwitch = flipXYfaceButtons;
}

// Function to poll gamepad input
void MoonlightInstance::PollGamepads() {
  if (emscripten_sample_gamepad_data() != EMSCRIPTEN_RESULT_SUCCESS) {
    std::cerr << "Sample gamepad data failed!\n";
    return;
  }

  // Prevent repeated trigger while the button combo is held down
  static std::array<bool, 16> comboTriggered{};
  static bool lastMouseEmulationSwitch = false;

  std::array<EmscriptenGamepadEvent, 16> activeGamepads{};
  const auto numGamepads = emscripten_get_num_gamepads();
  if (numGamepads == EMSCRIPTEN_RESULT_NOT_SUPPORTED) {
    std::cerr << "Get num gamepads failed!\n";
    return;
  }

  uint16_t activeGamepadMask = 0;
  int activeControllerCount = 0;

  for (int gamepadID = 0; gamepadID < numGamepads; ++gamepadID) {
    EmscriptenGamepadEvent gamepad;
    if (emscripten_get_gamepad_status(gamepadID, &gamepad) != EMSCRIPTEN_RESULT_SUCCESS || !gamepad.connected) {
      continue;
    }

    if (gamepad.timestamp == 0 && gamepad.numAxes == 0 && gamepad.numButtons == 0) {
      continue;
    }

    if (activeControllerCount >= 16) {
      break;
    }

    activeGamepads[activeControllerCount] = gamepad;
    activeGamepadMask |= static_cast<uint16_t>(1u << activeControllerCount);
    ++activeControllerCount;
  }

  if (mouseEmulationSwitch && !lastMouseEmulationSwitch) {
    playHeld.fill(false);
    mouseToggleFired.fill(false);
  }

  if (activeControllerCount == 0) {
    mouseOwnerControllerNumber = -1;
    mouseEmulationActive = false;
    playHeld.fill(false);
    mouseToggleFired.fill(false);
    comboTriggered.fill(false);
    ReleaseAllMouseButtons();
    lastMouseEmulationSwitch = mouseEmulationSwitch;
    lastActiveControllerCount = 0;
    return;
  } else if (mouseOwnerControllerNumber < 0 || mouseOwnerControllerNumber >= activeControllerCount) {
    mouseOwnerControllerNumber = 0;
    mouseEmulationActive = false;
    ReleaseAllMouseButtons();
  }

  if (activeControllerCount != lastActiveControllerCount) {
    playHeld.fill(false);
    mouseToggleFired.fill(false);
    comboTriggered.fill(false);
    lastActiveControllerCount = activeControllerCount;
  }

  // Iterate through connected gamepads and process their input
  for (int controllerNumber = 0; controllerNumber < activeControllerCount; ++controllerNumber) {
    const auto& gamepad = activeGamepads[controllerNumber];
    // Process input for active gamepad
    auto buttonFlags = GetButtonFlags(gamepad);
    const auto scaleTrigger = [](double value) {
      const auto scaled = std::lround(value * std::numeric_limits<unsigned char>::max());
      return static_cast<unsigned char>(std::clamp<long>(
        scaled,
        0,
        static_cast<long>(std::numeric_limits<unsigned char>::max())));
    };
    const auto scaleAxis = [](double value) {
      const auto scaled = std::lround(value * std::numeric_limits<short>::max());
      return static_cast<short>(std::clamp<long>(
        scaled,
        static_cast<long>(std::numeric_limits<short>::min()),
        static_cast<long>(std::numeric_limits<short>::max())));
    };

    const auto leftTrigger = scaleTrigger(gamepad.analogButton[GamepadButton::LeftTrigger]);
    const auto rightTrigger = scaleTrigger(gamepad.analogButton[GamepadButton::RightTrigger]);
    const auto leftStickX = scaleAxis(gamepad.axis[GamepadAxis::LeftX]);
    const auto leftStickY = scaleAxis(-gamepad.axis[GamepadAxis::LeftY]);
    const auto rightStickX = scaleAxis(gamepad.axis[GamepadAxis::RightX]);
    const auto rightStickY = scaleAxis(-gamepad.axis[GamepadAxis::RightY]);

    // Check if the current button flags match the defined button combination on the gamepad
    if ((buttonFlags & STOP_STREAM_BUTTONS) == STOP_STREAM_BUTTONS) {
      // Terminate the connection
      stopStream();
      return;
    } else if ((buttonFlags & PERF_STATS_BUTTONS) == PERF_STATS_BUTTONS) {
      if (!comboTriggered[controllerNumber]) {
        // Toggle performance stats overlay
        toggleStats();
        // Mark combo as triggered until buttons are released
        comboTriggered[controllerNumber] = true;
      }
    } else {
      // Reset when buttons are released
      comboTriggered[controllerNumber] = false;
    }

    // Check if the mouse emulation switch is checked; any controller may toggle, owner drives mouse events
    const bool playPressed = (buttonFlags & PLAY_FLAG) != 0;
    auto now = std::chrono::steady_clock::now();
    if (mouseEmulationSwitch) {
      if (playPressed && !playHeld[controllerNumber]) {
        mouseTogglePressTime[controllerNumber] = now;
        mouseToggleFired[controllerNumber] = false;
      }
      playHeld[controllerNumber] = playPressed;

      if (playPressed && !mouseToggleFired[controllerNumber]) {
        auto durationTime = std::chrono::duration_cast<std::chrono::milliseconds>(now - mouseTogglePressTime[controllerNumber]).count();
        if (durationTime >= 1000) {
          if (mouseOwnerControllerNumber != controllerNumber) {
            ReleaseAllMouseButtons();
            mouseOwnerControllerNumber = controllerNumber;
          }
          mouseEmulationActive = !mouseEmulationActive;
          PostToJs(mouseEmulationActive ? std::string("mouseEmulationOn") : std::string("mouseEmulationOff"));
          if (!mouseEmulationActive) {
            ReleaseAllMouseButtons();
          }
          mouseToggleFired[controllerNumber] = true;
        }
      }
      if (!playPressed) {
        mouseToggleFired[controllerNumber] = false;
      }
    } else if (!mouseEmulationSwitch && controllerNumber == mouseOwnerControllerNumber) {
      // Deactivate mouse emulation if the mouse emulation switch is unchecked
      mouseEmulationActive = false;
      playHeld[controllerNumber] = false;
      mouseToggleFired[controllerNumber] = false;
      ReleaseAllMouseButtons();
    } else {
      playHeld[controllerNumber] = playPressed;
      if (!playPressed) {
        mouseToggleFired[controllerNumber] = false;
      }
    }

    // If mouse emulation is active for this controller, then send mouse input to the desired handler (acts as a mouse)
    if (mouseEmulationActive && controllerNumber == mouseOwnerControllerNumber) {
      // Left Stick values are mapped to horizontal and vertical mouse movements
      const float baseMouseSpeed = 10.0f;
      const float leftStickMagnitude = std::sqrt(leftStickX * leftStickX + leftStickY * leftStickY) / std::numeric_limits<short>::max();
      const float mouseSpeed = baseMouseSpeed * leftStickMagnitude;
      const float mouseXDelta = static_cast<float>(leftStickX) / std::numeric_limits<short>::max() * mouseSpeed;
      const float mouseYDelta = -static_cast<float>(leftStickY) / std::numeric_limits<short>::max() * mouseSpeed;
      
      // Send a mouse move event with the specified delta values for both horizontal (X-axis) and vertical (Y-axis) coordinates
      LiSendMouseMoveEvent(static_cast<int>(mouseXDelta), static_cast<int>(mouseYDelta));

      // Right Stick values are mapped to horizontal and vertical mouse scrolls
      const float baseScrollSpeed = 1.0f;
      const float rightStickMagnitude = std::sqrt(rightStickX * rightStickX + rightStickY * rightStickY) / std::numeric_limits<short>::max();
      const float scrollSpeed = baseScrollSpeed * rightStickMagnitude;
      const float scrollXDelta = static_cast<float>(rightStickX) / std::numeric_limits<short>::max() * scrollSpeed;
      const float scrollYDelta = static_cast<float>(rightStickY) / std::numeric_limits<short>::max() * scrollSpeed;
      
      // Send mouse scroll events with the specified delta values for both horizontal (X-axis) and vertical (Y-axis) coordinates
      LiSendHScrollEvent(static_cast<int>(scrollXDelta));
      LiSendScrollEvent(static_cast<int>(scrollYDelta));

      // Face Buttons values are mapped to control mouse buttons
      if (buttonFlags & (A_FLAG | LB_FLAG)) {
        // Send a mouse button press event for the left button
        LiSendMouseButtonEvent(BUTTON_ACTION_PRESS, BUTTON_LEFT);
      } else {
        // Send a mouse button release event for the left button
        LiSendMouseButtonEvent(BUTTON_ACTION_RELEASE, BUTTON_LEFT);
      }
      if (buttonFlags & (X_FLAG | Y_FLAG)) {
        // Send a mouse button press event for the Middle button
        LiSendMouseButtonEvent(BUTTON_ACTION_PRESS, BUTTON_MIDDLE);
      } else {
        // Send a mouse button release event for the Middle button
        LiSendMouseButtonEvent(BUTTON_ACTION_RELEASE, BUTTON_MIDDLE);
      }
      if (buttonFlags & (B_FLAG | RB_FLAG)) {
        // Send a mouse button press event for the Right button
        LiSendMouseButtonEvent(BUTTON_ACTION_PRESS, BUTTON_RIGHT);
      } else {
        // Send a mouse button release event for the Right button
        LiSendMouseButtonEvent(BUTTON_ACTION_RELEASE, BUTTON_RIGHT);
      }
    } else {
      // If mouse emulation is inactive, then send gamepad input to the desired handler (acts as a gamepad)
      LiSendMultiControllerEvent(
        controllerNumber, static_cast<unsigned short>(activeGamepadMask), buttonFlags, leftTrigger,
        rightTrigger, leftStickX, leftStickY, rightStickX, rightStickY);
    }

  }
  lastMouseEmulationSwitch = mouseEmulationSwitch;
}

// Function to send controller rumble feedback for gamepad
void MoonlightInstance::ClControllerRumble(unsigned short controllerNumber, unsigned short lowFreqMotor, unsigned short highFreqMotor) {
  const float weakMagnitude = static_cast<float>(highFreqMotor) / static_cast<float>(UINT16_MAX);
  const float strongMagnitude = static_cast<float>(lowFreqMotor) / static_cast<float>(UINT16_MAX);
  
  // Check if the rumble feedback switch is checked
  if (rumbleFeedbackSwitch) {
    std::ostringstream ss;
    ss << controllerNumber << "," << weakMagnitude << "," << strongMagnitude;
    PostToJs(std::string("controllerRumble: ") + ss.str());
  }
}
