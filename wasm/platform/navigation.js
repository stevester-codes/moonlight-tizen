function isHTMLElement(el) {
  return (typeof HTMLElement !== 'undefined') && el instanceof HTMLElement;
}

function resolveElement(target) {
  if (!target) return null;
  if (isHTMLElement(target)) return target;
  if (typeof target === 'string') return document.getElementById(target);
  if (target && target[0] && target[0].nodeType === 1) return target[0];
  if (target && target.nodeType === 1) return target;
  if (target && target.element && isHTMLElement(target.element)) return target.element;
  if (target && target.el && isHTMLElement(target.el)) return target.el;
  if (target && typeof target.id === 'string') return document.getElementById(target.id);
  return null;
}

function resolveClickable(target) {
  const el = resolveElement(target);
  if (!el) return null;
  if (el.tagName === 'SELECT') return el; // allow native picker to open via click, no child search

  if (el.querySelector) {
    const child = el.querySelector('input[type="checkbox"], .mdl-switch__input, [role="switch"], button, [aria-pressed]');
    if (child && typeof child.click === 'function') {
      return child;
    }
  }
  if (typeof el.click === 'function') {
    return el;
  }
  return null;
}

function clickTarget(target) {
  const el = resolveClickable(target);
  if (el) {
    el.click();
  }
}

function safeFocus(idOrEl) {
  const el = resolveElement(idOrEl);
  if (el && typeof el.focus === 'function') {
    el.focus();
  }
}

function safeBlur(idOrEl) {
  const el = resolveElement(idOrEl);
  if (el && typeof el.blur === 'function') {
    el.blur();
  }
}

const hoveredClassName = 'hovered';

function markElement(element) {
  if (element) {
    element.classList.add(hoveredClassName);
    element.dispatchEvent(new Event('mouseenter'));
  }
}

function markElementById(id) {
  markElement(document.getElementById(id));
}

function mark(value) {
  const el = resolveElement(value);
  markElement(el);
}

function unmarkElement(element) {
  if (element) {
    element.classList.remove(hoveredClassName);
    element.dispatchEvent(new Event('mouseleave'));
  }
}

function unmarkElementById(id) {
  unmarkElement(document.getElementById(id));
}

function unmark(value) {
  const el = resolveElement(value);
  unmarkElement(el);
}

function isPopupActive(id) {
  const el = resolveElement(id);
  if (!el || !el.parentNode || !el.parentNode.children || el.parentNode.children.length < 4) {
    return false;
  }
  return el.parentNode.children[3].classList.contains('is-visible');
}

function changeIpAddressFieldValue(adjust) {
  const currentItem = this.view.current();
  if (currentItem.startsWith('ipAddressField')) {
    const digitElement = document.getElementById(currentItem);
    let currentValue = parseInt(digitElement.value, 10);
    currentValue = (currentValue + adjust + 256) % 256;
    digitElement.value = currentValue;
  }
}

class ListView {
  constructor(func) {
    this.index = 0;
    this.func = func;
  }

  current() {
    const array = this.func();
    return array[this.index];
  }

  prev() {
    const array = this.func();
    if (this.index > 0) {
      unmark(array[this.index]);
      --this.index;
      mark(array[this.index]);
    }
    return array[this.index];
  }

  next() {
    const array = this.func();
    if (this.index < array.length - 1) {
      unmark(array[this.index]);
      ++this.index;
      mark(array[this.index]);
    }
    return array[this.index];
  }

  prevCategory() {
    const array = this.func();
    if (this.index > 0) {
      unmark(array[this.index]);
      --this.index;
      mark(array[this.index]);
      // Indicate that there are more categories
      return true;
    }
    // Indicate that there are no more categories
    return false;
  }

  nextCategory() {
    const array = this.func();
    if (this.index < array.length - 1) {
      unmark(array[this.index]);
      ++this.index;
      mark(array[this.index]);
      // Indicate that there are more categories
      return true;
    }
    // Indicate that there are no more categories
    return false;
  }

  prevOption() {
    const array = this.func();
    unmark(array[this.index]);
    this.index = (this.index - 1 + array.length) % array.length;
    mark(array[this.index]);
    return array[this.index];
  }

  nextOption() {
    const array = this.func();
    unmark(array[this.index]);
    this.index = (this.index + 1) % array.length;
    mark(array[this.index]);
    return array[this.index];
  }

  prevCard(cardsPerRow) {
    const array = this.func();
    const currentRow = Math.floor(this.index / cardsPerRow);
    // Check if a previous card exists
    if (this.index > 0) {
      unmark(array[this.index]);
      --this.index;
      const newRow = Math.floor(this.index / cardsPerRow);
      mark(array[this.index]);
      if (newRow !== currentRow) {
        this.scrollToCardRow(newRow, cardsPerRow);
      }
    }
    return array[this.index];
  }

  nextCard(cardsPerRow) {
    const array = this.func();
    const currentRow = Math.floor(this.index / cardsPerRow);
    // Check if a next card exists
    if (this.index < array.length - 1) {
      unmark(array[this.index]);
      ++this.index;
      const newRow = Math.floor(this.index / cardsPerRow);
      mark(array[this.index]);
      if (newRow !== currentRow) {
        this.scrollToCardRow(newRow, cardsPerRow);
      }
    }
    return array[this.index];
  }

  currentCardRow(cardsPerRow) {
    const array = this.func();
    // Check if there are any card in the current row
    if (!array || array.length === 0) {
      return;
    }
    // Determine the current row based on the index
    const currentRow = Math.floor(this.index / cardsPerRow);
    // Scroll to the row containing the current card
    this.scrollToCardRow(currentRow, cardsPerRow);
  }

  prevCardRow(cardsPerRow) {
    const array = this.func();
    const currentRow = Math.floor(this.index / cardsPerRow);
    // Check if a previous card row exists
    if (currentRow > 0) {
      unmark(array[this.index]);
      this.index = Math.max(0, this.index - cardsPerRow);
      mark(array[this.index]);
      this.scrollToCardRow(currentRow - 1, cardsPerRow);
      // Indicate that there are more card rows
      return true;
    }
    // Indicate that there are no more card rows
    return false;
  }

  nextCardRow(cardsPerRow) {
    const array = this.func();
    const rows = Math.ceil(array.length / cardsPerRow);
    const currentRow = Math.floor(this.index / cardsPerRow);
    // Check if a next card row exists
    if (currentRow < rows - 1) {
      unmark(array[this.index]);
      this.index = Math.min(array.length - 1, this.index + cardsPerRow);
      mark(array[this.index]);
      this.scrollToCardRow(currentRow + 1, cardsPerRow);
      // Indicate that there are more card rows
      return true;
    }
    // Indicate that there are no more card rows
    return false;
  }

  scrollToCardRow(row, cardsPerRow) {
    const array = this.func();
    const targetCard = array[row * cardsPerRow];
    if (targetCard) {
      requestAnimationFrame(() => {
        targetCard.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      });
    }
  }
};

const Views = {
  Hosts: {
    view: new ListView(() => document.getElementById('host-grid').children),
    up: function() {
      // If there are more rows behind, then go to the previous row
      if (this.view.prevCardRow(5)) {
        safeFocus(this.view.current());
      } else {
        // If there are no more rows, navigate to the HostsNav view
        Navigation.change(Views.HostsNav);
        // Set focus on the first navigation item in HostsNav view when transitioning from Hosts view
        safeFocus(Views.HostsNav.view.current());
      }
    },
    down: function() {
      // If there are more rows after, then go to the next row
      if (this.view.nextCardRow(5)) {
        safeFocus(this.view.current());
      }
    },
    left: function() {
      this.view.prevCard(5);
      safeFocus(this.view.current());
    },
    right: function() {
      this.view.nextCard(5);
      safeFocus(this.view.current());
    },
    select: function() {
      const currentItem = this.view.current();
      if (currentItem && currentItem.id === 'addHostContainer') {
        clickTarget(currentItem);
      } else {
        clickTarget(currentItem ? currentItem.children[0] : currentItem);
      }
    },
    accept: function() {
      const currentItem = this.view.current();
      if (currentItem && currentItem.id === 'addHostContainer') {
        clickTarget(currentItem);
      } else {
        clickTarget(currentItem ? currentItem.children[0] : currentItem);
      }
    },
    back: function() {
      // Show the Exit Moonlight dialog and push the view
      exitAppDialog();
    },
    press: function() {
      const currentItem = resolveElement(this.view.current());
      if (currentItem && currentItem.id !== 'addHostContainer') {
        const menuButton = currentItem.children ? currentItem.children[1] : null;
        safeFocus(menuButton);
        // Show the Host Menu dialog and push the view
        setTimeout(() => clickTarget(menuButton), 600);
      }
    },
    switch: function() {
      const currentItem = resolveElement(this.view.current());
      if (!currentItem) {
        return;
      }
      if (currentItem.id === 'addHostContainer') {
        safeFocus(currentItem);
      } else {
        this.view.currentCardRow(5);
        const hostCard = currentItem.children ? currentItem.children[0] : null;
        safeFocus(hostCard ? hostCard : currentItem);
      }
    },
    enter: function() {
      mark(this.view.current());
    },
    leave: function() {
      unmark(this.view.current());
    },
  },
  HostsNav: {
    view: new ListView(() => {
      if (document.getElementById('updateAppBtn')) {
        return ['updateAppBtn', 'settingsBtn', 'supportBtn'];
      } else {
        return ['settingsBtn', 'supportBtn'];
      }
    }),
    up: function() {},
    down: function() {
      // Remove focus from the current element before changing the view
      safeBlur(this.view.current());
      // Navigate to the Hosts view
      Navigation.change(Views.Hosts);
      // Set focus on the first navigation item in Hosts view when transitioning from HostsNav view
      safeFocus(Views.Hosts.view.current());
    },
    left: function() {
      this.view.prev();
      safeFocus(this.view.current());
    },
    right: function() {
      this.view.next();
      safeFocus(this.view.current());
    },
    select: function() {
      clickTarget(this.view.current());
    },
    accept: function() {
      clickTarget(this.view.current());
    },
    back: function() {
      // Remove focus from the current element before changing the view
      safeBlur(this.view.current());
      // Navigate to the Hosts view
      Navigation.change(Views.Hosts);
    },
    press: function() {},
    switch: function() {
      safeFocus(this.view.current());
    },
    enter: function() {
      mark(this.view.current());
    },
    leave: function() {
      unmark(this.view.current());
    },
  },
  AddHostDialog: {
    view: new ListView(() => {
      if (document.getElementById('ipAddressFieldModeSwitch').checked) {
        return ['ipAddressField1', 'ipAddressField2', 'ipAddressField3', 'ipAddressField4', 'continueAddHost', 'cancelAddHost'];
      } else {
        return ['ipAddressTextInput', 'continueAddHost', 'cancelAddHost'];
      }
    }),
    up: function() {
      if (document.getElementById('ipAddressFieldModeSwitch').checked) {
        changeIpAddressFieldValue.call(this, 1);
      }
    },
    down: function() {
      if (document.getElementById('ipAddressFieldModeSwitch').checked) {
        changeIpAddressFieldValue.call(this, -1);
      }
    },
    left: function() {
      if (document.getElementById('ipAddressFieldModeSwitch').checked) {
        const currentItem = this.view.current();
        if (currentItem.startsWith('ipAddressField') &&
            currentItem !== 'continueAddHost' &&
            currentItem !== 'cancelAddHost') {
          // Remove focus from any currently focused item element
          safeBlur(currentItem);
          this.view.prev();
          safeFocus(this.view.current());
        } else {
          this.view.prev();
          safeFocus(this.view.current());
        }
      } else {
        this.view.prev();
        safeFocus(this.view.current());
      }
    },
    right: function() {
      if (document.getElementById('ipAddressFieldModeSwitch').checked) {
        const currentItem = this.view.current();
        if (currentItem.startsWith('ipAddressField') && currentItem !== 'ipAddressField4') {
          // Remove focus from any currently focused item element
          safeBlur(currentItem);
          this.view.next();
          safeFocus(this.view.current());
        } else {
          this.view.next();
          safeFocus(this.view.current());
        }
      } else {
        this.view.next();
        safeFocus(this.view.current());
      }
    },
    select: function() {
      clickTarget(this.view.current());
    },
    accept: function() {
      clickTarget(this.view.current());
    },
    back: function() {
      clickTarget('cancelAddHost');
    },
    press: function() {
      clickTarget('ipAddressFieldModeSwitch');
    },
    switch: function() {
      const currentItem = this.view.current();
      if (currentItem === 'continueAddHost' || currentItem === 'cancelAddHost') {
        // Set focus only on the Continue or Cancel button element
        safeFocus(currentItem);
      } else {
        // Remove focus from any other focused item element
        safeBlur(currentItem);
      }
    },
    enter: function() {
      mark(this.view.current());
    },
    leave: function() {
      unmark(this.view.current());
    },
  },
  PairingDialog: {
    view: new ListView(() => [
      'cancelPairing'
    ]),
    up: function() {
      safeBlur("cancelPairing");
    },
    down: function() {
      safeFocus("cancelPairing");
    },
    left: function() {},
    right: function() {},
    select: function() {
      clickTarget(this.view.current());
    },
    accept: function() {
      clickTarget(this.view.current());
    },
    back: function() {
      clickTarget('cancelPairing');
    },
    press: function() {},
    switch: function() {},
    enter: function() {
      mark(this.view.current());
    },
    leave: function() {
      unmark(this.view.current());
    },
  },
  HostMenuDialog: {
    view: new ListView(() => {
      const actions = ['refreshApps', 'wakeHost', 'deleteHost', 'viewDetails', 'closeHostMenu'];
      return actions.map(action => action === 'closeHostMenu' ? action : action + '-' + Views.HostMenuDialog.hostname);
    }),
    up: function() {
      this.view.prevOption();
      safeFocus(this.view.current());
    },
    down: function() {
      this.view.nextOption();
      safeFocus(this.view.current());
    },
    left: function() {},
    right: function() {},
    select: function() {
      clickTarget(this.view.current());
    },
    accept: function() {
      clickTarget(this.view.current());
    },
    back: function() {
      clickTarget('closeHostMenu');
    },
    press: function() {},
    switch: function() {
      safeFocus(this.view.current());
    },
    enter: function() {
      mark(this.view.current());
    },
    leave: function() {
      unmark(this.view.current());
    },
  },
  DeleteHostDialog: {
    view: new ListView(() => [
      'continueDeleteHost',
      'cancelDeleteHost'
    ]),
    up: function() {},
    down: function() {},
    left: function() {
      this.view.prev();
      safeFocus("continueDeleteHost");
    },
    right: function() {
      this.view.next();
      safeFocus("cancelDeleteHost");
    },
    select: function() {
      clickTarget(this.view.current());
    },
    accept: function() {
      clickTarget(this.view.current());
    },
    back: function() {
      clickTarget('cancelDeleteHost');
    },
    press: function() {},
    switch: function() {},
    enter: function() {
      mark(this.view.current());
    },
    leave: function() {
      unmark(this.view.current());
    },
  },
  HostDetailsDialog: {
    view: new ListView(() => [
      'closeHostDetails'
    ]),
    up: function() {
      safeBlur("closeHostDetails");
    },
    down: function() {
      safeFocus("closeHostDetails");
    },
    left: function() {},
    right: function() {},
    select: function() {
      clickTarget(this.view.current());
    },
    accept: function() {
      clickTarget(this.view.current());
    },
    back: function() {
      clickTarget('closeHostDetails');
    },
    press: function() {},
    switch: function() {
      safeFocus(this.view.current());
    },
    enter: function() {
      mark(this.view.current());
    },
    leave: function() {
      unmark(this.view.current());
    },
  },
  MoonlightSupportDialog: {
    view: new ListView(() => [
      'closeAppSupport'
    ]),
    up: function() {
      safeBlur("closeAppSupport");
    },
    down: function() {
      safeFocus("closeAppSupport");
    },
    left: function() {},
    right: function() {},
    select: function() {
      clickTarget(this.view.current());
    },
    accept: function() {
      clickTarget(this.view.current());
    },
    back: function() {
      clickTarget('closeAppSupport');
    },
    press: function() {},
    switch: function() {},
    enter: function() {
      mark(this.view.current());
    },
    leave: function() {
      unmark(this.view.current());
    },
  },
  Settings: {
    view: new ListView(() => document.querySelector('.settings-categories').children),
    up: function() {
      // If there are more categories behind, then go to the previous category
      if (this.view.prevCategory()) {
        safeFocus(this.view.current());
      } else {
        // If there are no more categories, navigate to the SettingsNav view
        Navigation.change(Views.SettingsNav);
        // Set focus on the first navigation item in SettingsNav view when transitioning from Settings view
        safeFocus(Views.SettingsNav.view.current());
      }
    },
    down: function() {
      // If there are more categories after, then go to the next category
      if (this.view.nextCategory()) {
        safeFocus(this.view.current());
      }
    },
    left: function() {},
    right: function() {},
    select: function() {
      clickTarget(this.view.current());
    },
    accept: function() {
      clickTarget(this.view.current());
    },
    back: function() {
      clickTarget('goBackBtn');
      // Navigate to the HostsNav view
      Navigation.change(Views.HostsNav);
      safeFocus("settingsBtn");
    },
    press: function() {},
    switch: function() {
      safeFocus(this.view.current());
    },
    enter: function() {
      mark(this.view.current());
    },
    leave: function() {
      unmark(this.view.current());
    },
  },
  SettingsNav: {
    view: new ListView(() => [
      'goBackBtn',
      'restoreDefaultsBtn'
    ]),
    up: function() {},
    down: function() {
      // Navigate to the Settings view
      Navigation.change(Views.Settings);
      // Set focus on the first navigation item in Settings view when transitioning from SettingsNav view
      safeFocus(Views.Settings.view.current());
    },
    left: function() {
      this.view.prev();
      safeFocus(this.view.current());
    },
    right: function() {
      this.view.next();
      safeFocus(this.view.current());
    },
    select: function() {
      const currentItem = this.view.current();
      if (currentItem.id === 'goBackBtn') {
        clickTarget(currentItem);
        // Navigate to the HostsNav view
        Navigation.change(Views.HostsNav);
        safeFocus('settingsBtn');
      } else {
        clickTarget(this.view.current());
      }
    },
    accept: function() {
      const currentItem = resolveElement(this.view.current());
      if (currentItem && currentItem.id === 'goBackBtn') {
        clickTarget(currentItem);
        // Navigate to the HostsNav view
        Navigation.change(Views.HostsNav);
        safeFocus('settingsBtn');
      } else {
        clickTarget(this.view.current());
      }
    },
    back: function() {
      clickTarget('goBackBtn');
      // Navigate to the HostsNav view
      Navigation.change(Views.HostsNav);
      safeFocus("settingsBtn");
    },
    press: function() {},
    switch: function() {
      safeFocus(this.view.current());
    },
    enter: function() {
      mark(this.view.current());
    },
    leave: function() {
      unmark(this.view.current());
    },
  },
  BasicSettings: {
    view: new ListView(() => [
      'selectResolution',
      'selectFramerate',
      'selectBitrate',
      'framePacingBtn'
    ]),
    up: function() {
      this.view.prevOption();
      safeFocus(this.view.current());
    },
    down: function() {
      this.view.nextOption();
      safeFocus(this.view.current());
    },
    left: function() {},
    right: function() {},
    select: function() {
      clickTarget(this.view.current());
    },
    accept: function() {
      clickTarget(this.view.current());
    },
    back: function() {
      // Remove focus from the current element before changing the view
      safeBlur(this.view.current());
      // Reset the current settings view before navigating to the next settings view
      resetSettingsView();
      // Navigate to the Settings view
      Navigation.change(Views.Settings);
      // Set focus on the category item in Settings view when transitioning from BasicSettings view
      safeFocus(Views.Settings.view.current());
    },
    press: function() {},
    switch: function() {
      safeFocus(this.view.current());
    },
    enter: function() {
      mark(this.view.current());
    },
    leave: function() {
      unmark(this.view.current());
    },
  },
  SelectResolutionMenu: {
    isActive: () => isPopupActive('videoResolutionMenu'),
    view: new ListView(() => 
      document.getElementById('videoResolutionMenu')
      .parentNode.children[3].children[1].children),
    up: function() {
      this.view.prevOption();
      safeFocus(this.view.current());
    },
    down: function() {
      this.view.nextOption();
      safeFocus(this.view.current());
    },
    left: function() {},
    right: function() {},
    select: function() {
      clickTarget(this.view.current());
      safeFocus("selectResolution");
    },
    accept: function() {
      clickTarget(this.view.current());
      Navigation.pop();
      safeFocus("selectResolution");
    },
    back: function() {
      clickTarget('selectResolution');
      safeFocus("selectResolution");
    },
    press: function() {},
    switch: function() {},
    enter: function() {
      mark(this.view.current());
    },
    leave: function() {
      unmark(this.view.current());
    },
  },
  SelectFramerateMenu: {
    isActive: () => isPopupActive('videoFramerateMenu'),
    view: new ListView(() => 
      document.getElementById('videoFramerateMenu')
      .parentNode.children[3].children[1].children),
    up: function() {
      this.view.prevOption();
      safeFocus(this.view.current());
    },
    down: function() {
      this.view.nextOption();
      safeFocus(this.view.current());
    },
    left: function() {},
    right: function() {},
    select: function() {
      clickTarget(this.view.current());
      safeFocus("selectFramerate");
    },
    accept: function() {
      clickTarget(this.view.current());
      Navigation.pop();
      safeFocus("selectFramerate");
    },
    back: function() {
      clickTarget('selectFramerate');
      safeFocus("selectFramerate");
    },
    press: function() {},
    switch: function() {},
    enter: function() {
      mark(this.view.current());
    },
    leave: function() {
      unmark(this.view.current());
    },
  },
  SelectBitrateMenu: {
    isActive: () => isPopupActive('videoBitrateMenu'),
    view: new ListView(() => 
      document.getElementById('videoBitrateMenu')
      .parentNode.children[3].children[1].children),
    up: function() {},
    down: function() {},
    left: function() {
      bitrateSlider.stepDown();
      bitrateSlider.dispatchEvent(new Event('input'));
    },
    right: function() {
      bitrateSlider.stepUp();
      bitrateSlider.dispatchEvent(new Event('input'));
    },
    select: function() {
      clickTarget(this.view.current());
      safeFocus("selectBitrate");
    },
    accept: function() {
      clickTarget('selectBitrate');
      safeFocus("selectBitrate");
    },
    back: function() {
      clickTarget('selectBitrate');
      safeFocus("selectBitrate");
    },
    press: function() {},
    switch: function() {},
    enter: function() {
      mark(this.view.current());
    },
    leave: function() {
      unmark(this.view.current());
    },
  },
  InterfaceSettings: {
    view: new ListView(() => [
      'ipAddressFieldModeBtn',
      'unlockAllFpsBtn',
      'disableWarningsBtn',
      'performanceStatsBtn'
    ]),
    up: function() {
      this.view.prevOption();
      safeFocus(this.view.current());
    },
    down: function() {
      this.view.nextOption();
      safeFocus(this.view.current());
    },
    left: function() {},
    right: function() {},
    select: function() {
      clickTarget(this.view.current());
    },
    accept: function() {
      clickTarget(this.view.current());
    },
    back: function() {
      // Remove focus from the current element before changing the view
      safeBlur(this.view.current());
      // Reset the current settings view before navigating to the next settings view
      resetSettingsView();
      // Navigate to the Settings view
      Navigation.change(Views.Settings);
      // Set focus on the category item in Settings view when transitioning from InterfaceSettings view
      safeFocus(Views.Settings.view.current());
    },
    press: function() {},
    switch: function() {
      safeFocus(this.view.current());
    },
    enter: function() {
      mark(this.view.current());
    },
    leave: function() {
      unmark(this.view.current());
    },
  },
  HostSettings: {
    view: new ListView(() => [
      'sortAppsListBtn',
      'optimizeGamesBtn',
      'removeAllHostsBtn'
    ]),
    up: function() {
      this.view.prevOption();
      safeFocus(this.view.current());
    },
    down: function() {
      this.view.nextOption();
      safeFocus(this.view.current());
    },
    left: function() {},
    right: function() {},
    select: function() {
      clickTarget(this.view.current());
    },
    accept: function() {
      clickTarget(this.view.current());
    },
    back: function() {
      // Remove focus from the current element before changing the view
      safeBlur(this.view.current());
      // Reset the current settings view before navigating to the next settings view
      resetSettingsView();
      // Navigate to the Settings view
      Navigation.change(Views.Settings);
      // Set focus on the category item in Settings view when transitioning from HostSettings view
      safeFocus(Views.Settings.view.current());
    },
    press: function() {},
    switch: function() {
      safeFocus(this.view.current());
    },
    enter: function() {
      mark(this.view.current());
    },
    leave: function() {
      unmark(this.view.current());
    },
  },
  InputSettings: {
    view: new ListView(() => [
      'rumbleFeedbackBtn',
      'mouseEmulationBtn',
      'flipABfaceButtonsBtn',
      'flipXYfaceButtonsBtn'
    ]),
    up: function() {
      this.view.prevOption();
      safeFocus(this.view.current());
    },
    down: function() {
      this.view.nextOption();
      safeFocus(this.view.current());
    },
    left: function() {},
    right: function() {},
    select: function() {
      clickTarget(this.view.current());
    },
    accept: function() {
      clickTarget(this.view.current());
    },
    back: function() {
      // Remove focus from the current element before changing the view
      safeBlur(this.view.current());
      // Reset the current settings view before navigating to the next settings view
      resetSettingsView();
      // Navigate to the Settings view
      Navigation.change(Views.Settings);
      // Set focus on the category item in Settings view when transitioning from InputSettings view
      safeFocus(Views.Settings.view.current());
    },
    press: function() {},
    switch: function() {
      safeFocus(this.view.current());
    },
    enter: function() {
      mark(this.view.current());
    },
    leave: function() {
      unmark(this.view.current());
    },
  },
  AudioSettings: {
    view: new ListView(() => [
      'selectAudio',
      'audioSyncBtn',
      'playHostAudioBtn'
    ]),
    up: function() {
      this.view.prevOption();
      safeFocus(this.view.current());
    },
    down: function() {
      this.view.nextOption();
      safeFocus(this.view.current());
    },
    left: function() {},
    right: function() {},
    select: function() {
      clickTarget(this.view.current());
    },
    accept: function() {
      clickTarget(this.view.current());
    },
    back: function() {
      // Remove focus from the current element before changing the view
      safeBlur(this.view.current());
      // Reset the current settings view before navigating to the next settings view
      resetSettingsView();
      // Navigate to the Settings view
      Navigation.change(Views.Settings);
      // Set focus on the category item in Settings view when transitioning from AudioSettings view
      safeFocus(Views.Settings.view.current());
    },
    press: function() {},
    switch: function() {
      safeFocus(this.view.current());
    },
    enter: function() {
      mark(this.view.current());
    },
    leave: function() {
      unmark(this.view.current());
    },
  },
  SelectAudioMenu: {
    isActive: () => isPopupActive('audioConfigMenu'),
    view: new ListView(() => 
      document.getElementById('audioConfigMenu')
      .parentNode.children[3].children[1].children),
    up: function() {
      this.view.prevOption();
      safeFocus(this.view.current());
    },
    down: function() {
      this.view.nextOption();
      safeFocus(this.view.current());
    },
    left: function() {},
    right: function() {},
    select: function() {
      clickTarget(this.view.current());
      safeFocus("selectAudio");
      // Show the required Restart Moonlight dialog and push the view
      setTimeout(() => requiredRestartAppDialog(), 800);
    },
    accept: function() {
      clickTarget(this.view.current());
      Navigation.pop();
      safeFocus("selectAudio");
      // Show the required Restart Moonlight dialog and push the view
      setTimeout(() => requiredRestartAppDialog(), 800);
    },
    back: function() {
      clickTarget('selectAudio');
      safeFocus("selectAudio");
    },
    press: function() {},
    switch: function() {},
    enter: function() {
      mark(this.view.current());
    },
    leave: function() {
      unmark(this.view.current());
    },
  },
  VideoSettings: {
    view: new ListView(() => [
      'selectCodec',
      'hdrModeBtn',
      'fullRangeBtn'
    ]),
    up: function() {
      this.view.prevOption();
      safeFocus(this.view.current());
    },
    down: function() {
      this.view.nextOption();
      safeFocus(this.view.current());
    },
    left: function() {},
    right: function() {},
    select: function() {
      clickTarget(this.view.current());
    },
    accept: function() {
      clickTarget(this.view.current());
    },
    back: function() {
      // Remove focus from the current element before changing the view
      safeBlur(this.view.current());
      // Reset the current settings view before navigating to the next settings view
      resetSettingsView();
      // Navigate to the Settings view
      Navigation.change(Views.Settings);
      // Set focus on the category item in Settings view when transitioning from VideoSettings view
      safeFocus(Views.Settings.view.current());
    },
    press: function() {},
    switch: function() {
      safeFocus(this.view.current());
    },
    enter: function() {
      mark(this.view.current());
    },
    leave: function() {
      unmark(this.view.current());
    },
  },
  SelectCodecMenu: {
    isActive: () => isPopupActive('videoCodecMenu'),
    view: new ListView(() => 
      document.getElementById('videoCodecMenu')
      .parentNode.children[3].children[1].children),
    up: function() {
      this.view.prevOption();
      safeFocus(this.view.current());
    },
    down: function() {
      this.view.nextOption();
      safeFocus(this.view.current());
    },
    left: function() {},
    right: function() {},
    select: function() {
      clickTarget(this.view.current());
      safeFocus("selectCodec");
      // Show the required Restart Moonlight dialog and push the view
      setTimeout(() => requiredRestartAppDialog(), 800);
    },
    accept: function() {
      clickTarget(this.view.current());
      Navigation.pop();
      safeFocus("selectCodec");
      // Show the required Restart Moonlight dialog and push the view
      setTimeout(() => requiredRestartAppDialog(), 800);
    },
    back: function() {
      clickTarget('selectCodec');
      safeFocus("selectCodec");
    },
    press: function() {},
    switch: function() {},
    enter: function() {
      mark(this.view.current());
    },
    leave: function() {
      unmark(this.view.current());
    },
  },
  AboutSettings: {
    view: new ListView(() => [
      'systemInfoBtn',
      'navigationGuideBtn',
      'checkUpdatesBtn',
      'restartAppBtn'
    ]),
    up: function() {
      this.view.prevOption();
      safeFocus(this.view.current());
    },
    down: function() {
      this.view.nextOption();
      safeFocus(this.view.current());
    },
    left: function() {},
    right: function() {},
    select: function() {
      clickTarget(this.view.current());
    },
    accept: function() {
      clickTarget(this.view.current());
    },
    back: function() {
      // Remove focus from the current element before changing the view
      safeBlur(this.view.current());
      // Reset the current settings view before navigating to the next settings view
      resetSettingsView();
      // Navigate to the Settings view
      Navigation.change(Views.Settings);
      // Set focus on the category item in Settings view when transitioning from AboutSettings view
      safeFocus(Views.Settings.view.current());
    },
    press: function() {},
    switch: function() {
      safeFocus(this.view.current());
    },
    enter: function() {
      mark(this.view.current());
    },
    leave: function() {
      unmark(this.view.current());
    },
  },
  NavigationGuideDialog: {
    view: new ListView(() => [
      'closeNavGuide'
    ]),
    up: function() {
      safeBlur("closeNavGuide");
    },
    down: function() {
      safeFocus("closeNavGuide");
    },
    left: function() {},
    right: function() {},
    select: function() {
      clickTarget(this.view.current());
    },
    accept: function() {
      clickTarget(this.view.current());
    },
    back: function() {
      clickTarget('closeNavGuide');
    },
    press: function() {},
    switch: function() {},
    enter: function() {
      mark(this.view.current());
    },
    leave: function() {
      unmark(this.view.current());
    },
  },
  UpdateMoonlightDialog: {
    view: new ListView(() => [
      'closeUpdateApp'
    ]),
    up: function() {
      safeBlur("closeUpdateApp");
    },
    down: function() {
      safeFocus("closeUpdateApp");
    },
    left: function() {},
    right: function() {},
    select: function() {
      clickTarget(this.view.current());
    },
    accept: function() {
      clickTarget(this.view.current());
    },
    back: function() {
      clickTarget('closeUpdateApp');
    },
    press: function() {},
    switch: function() {
      safeFocus(this.view.current());
    },
    enter: function() {
      mark(this.view.current());
    },
    leave: function() {
      unmark(this.view.current());
    },
  },
  RestoreDefaultsDialog: {
    view: new ListView(() => [
      'continueRestoreDefaults',
      'cancelRestoreDefaults'
    ]),
    up: function() {},
    down: function() {},
    left: function() {
      this.view.prev();
      safeFocus("continueRestoreDefaults");
    },
    right: function() {
      this.view.next();
      safeFocus("cancelRestoreDefaults");
    },
    select: function() {
      clickTarget(this.view.current());
    },
    accept: function() {
      clickTarget(this.view.current());
    },
    back: function() {
      clickTarget('cancelRestoreDefaults');
    },
    press: function() {},
    switch: function() {},
    enter: function() {
      mark(this.view.current());
    },
    leave: function() {
      unmark(this.view.current());
    },
  },
  Apps: {
    view: new ListView(() => document.getElementById('game-grid').children),
    up: function() {
      // If there are more rows behind, then go to the previous row
      if (this.view.prevCardRow(6)) {
        safeFocus(this.view.current());
      } else {
        // If there are no more rows, navigate to the AppsNav view
        Navigation.change(Views.AppsNav);
        // Set focus on the first navigation item in AppsNav view when transitioning from Apps view
      safeFocus(Views.AppsNav.view.current());
      }
    },
    down: function() {
      // If there are more rows after, then go to the next row
      if (this.view.nextCardRow(6)) {
        safeFocus(this.view.current());
      }
    },
    left: function() {
      this.view.prevCard(6);
      safeFocus(this.view.current());
    },
    right: function() {
      this.view.nextCard(6);
      safeFocus(this.view.current());
    },
    select: function() {
      clickTarget(this.view.current());
    },
    accept: function() {
      clickTarget(this.view.current());
    },
    back: function() {
      clickTarget('goBackBtn');
    },
    press: function() {},
    switch: function() {
      this.view.currentCardRow(6);
    },
    enter: function() {
      mark(this.view.current());
    },
    leave: function() {
      unmark(this.view.current());
    },
  },
  AppsNav: {
    view: new ListView(() => [
      'goBackBtn',
      'quitRunningAppBtn'
    ]),
    up: function() {},
    down: function() {
      // Navigate to the Apps view
      Navigation.change(Views.Apps);
      // Set focus on the first navigation item in Apps view when transitioning from AppsNav view
      safeFocus(Views.Apps.view.current());
    },
    left: function() {
      this.view.prev();
      safeFocus(this.view.current());
    },
    right: function() {
      this.view.next();
      safeFocus(this.view.current());
    },
    select: function() {
      clickTarget(this.view.current());
    },
    accept: function() {
      clickTarget(this.view.current());
    },
    back: function() {
      clickTarget('goBackBtn');
    },
    press: function() {},
    switch: function() {
      safeFocus(this.view.current());
    },
    enter: function() {
      mark(this.view.current());
    },
    leave: function() {
      unmark(this.view.current());
    },
  },
  QuitAppDialog: {
    view: new ListView(() => [
      'continueQuitApp',
      'cancelQuitApp'
    ]),
    up: function() {},
    down: function() {},
    left: function() {
      this.view.prev();
      safeFocus("continueQuitApp");
    },
    right: function() {
      this.view.next();
      safeFocus("cancelQuitApp");
    },
    select: function() {
      clickTarget(this.view.current());
    },
    accept: function() {
      clickTarget(this.view.current());
    },
    back: function() {
      clickTarget('cancelQuitApp');
    },
    press: function() {},
    switch: function() {},
    enter: function() {
      mark(this.view.current());
    },
    leave: function() {
      unmark(this.view.current());
    },
  },
  RestartMoonlightDialog: {
    view: new ListView(() => [
      'continueRestartApp',
      'cancelRestartApp'
    ]),
    up: function() {},
    down: function() {},
    left: function() {
      this.view.prev();
      safeFocus("continueRestartApp");
    },
    right: function() {
      this.view.next();
      safeFocus("cancelRestartApp");
    },
    select: function() {
      clickTarget(this.view.current());
    },
    accept: function() {
      clickTarget(this.view.current());
    },
    back: function() {
      clickTarget('cancelRestartApp');
    },
    press: function() {},
    switch: function() {},
    enter: function() {
      mark(this.view.current());
    },
    leave: function() {
      unmark(this.view.current());
    },
  },
  ExitMoonlightDialog: {
    view: new ListView(() => [
      'continueExitApp',
      'cancelExitApp'
    ]),
    up: function() {},
    down: function() {},
    left: function() {
      this.view.prev();
      safeFocus("continueExitApp");
    },
    right: function() {
      this.view.next();
      safeFocus("cancelExitApp");
    },
    select: function() {
      clickTarget(this.view.current());
    },
    accept: function() {
      clickTarget(this.view.current());
    },
    back: function() {
      clickTarget('cancelExitApp');
    },
    press: function() {},
    switch: function() {},
    enter: function() {
      mark(this.view.current());
    },
    leave: function() {
      unmark(this.view.current());
    },
  },
};

const Navigation = (function() {
  let hasFocus = false;

  function loseFocus() {
    if (hasFocus) {
      hasFocus = false;
      Stack.get().leave();
    }
  }

  function focus() {
    if (!hasFocus) {
      hasFocus = true;
      Stack.get().enter();
    }
  }

  function runOp(name) {
    return () => {
      if (!State.isRunning()) {
        return;
      }

      if (!hasFocus) {
        focus();
        return;
      }

      const view = Stack.get();
      if (view[name]) {
        view[name]();
      }
    };
  }

  const Stack = (function() {
    const viewStack = [];

    function get() {
      return viewStack[viewStack.length - 1];
    }

    function push(view, hostname) {
      if (get()) {
        get().leave();
      }
      if (hostname !== undefined) {
        view.hostname = hostname;
      }
      viewStack.push(view);
      get().enter();
    }

    function change(view) {
      get().leave();
      viewStack[viewStack.length - 1] = view;
      get().enter();
    }

    function pop() {
      if (viewStack.length > 1) {
        get().leave();
        viewStack.pop();
        get().enter();
      }
    }

    return {
      get,
      push,
      change,
      pop
    };
  })();

  const State = (function() {
    let running = false;

    function start() {
      if (!running) {
        running = true;
        window.addEventListener('mousemove', loseFocus);
      }
    }

    function stop() {
      if (running) {
        running = false;
        window.removeEventListener('mousemove', loseFocus);
      }
    }

    function isRunning() {
      return running;
    }

    return {
      start,
      stop,
      isRunning
    };
  })();

  return {
    up: runOp('up'),
    down: runOp('down'),
    left: runOp('left'),
    right: runOp('right'),
    select: runOp('select'),
    accept: runOp('accept'),
    back: runOp('back'),
    press: runOp('press'),
    switch: runOp('switch'),
    push: Stack.push,
    change: Stack.change,
    pop: Stack.pop,
    start: State.start,
    stop: State.stop,
  };
})();
