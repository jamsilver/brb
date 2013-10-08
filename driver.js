(function () {
  'use strict';

  /**
   * The following code has inspired this:
   *
   *  - https://github.com/derrick/dream_cheeky
   *  - https://github.com/pathikrit/node-thunder-driver
   *  - http://www.lunarlamp.co.uk/usb-panic-button-linux#comment-108
   *  - http://search.cpan.org/~bkendi/Device-USB-PanicButton-0.04/lib/Device/USB/PanicButton.pm
   *  - https://groups.google.com/forum/#!topic/nodejs/9Kh3Q2uEWX8
   */

  var util = require("util");
  var events = require("events");
  var udev = require("udev");
  var usb = require('usb/usb.js');
  var uuid = require('node-uuid');

  // Some useful constants.
  var BIGREDBUTTON = {
    ID: {
      VENDOR : 0x1d34,
      VENDOR_STRING : '1d34',
      PRODUCT: 0x000d
    },
    /*
      The least significant 2 bits indicate the state of the
      lid and the button respectively.

        [lid]   [button]           vv
        CLOSED  PRESSED  0x14 = 10100
        CLOSED    UP     0x15 = 10101
         OPEN    DOWN:   0x16 = 10110
         OPEN     UP:    0x17 = 10111
     */
    STATE: {
      // So bit-wise ANDing is in order here.
      LID_OPEN: 0x16,
      BUTTON_UP: 0x15
    }
  };

  // We aim to keep a single array of all the big red buttons plugged into
  // the system. If one is unplugged and re-plugged in we'll attempt to gloss
  // over the hiccup and keep on operating with it.
  var bigredbuttons = {};


  /**
   * CONTROLLERS DRIVER 'INTERFACE'
   *
   *  EXTENDS
   *   EventEmitter
   *
   *  EVENTS
   *    1. connected
   *    2. disconnected (probably not used but hey)
   *
   *  METHODS
   *    1. checkForControllers()
   *
   */
  function ControllersDriver() {

    var self = this;
    events.EventEmitter.call(self);

    // We put pretty much this entire constructor in a nextTick().
    // This is so all of our code which searches for USB devices, and registers
    // UDEV monitor callbacks will never attach before our caller has a chance
    // to customize our configuration.
    //
    // This approach will make more sense on the day we *have* configuration!
    process.nextTick(function() {

      // Detect when the USB big red button is plugged in.
      var udev_monitor = udev.monitor();
      udev_monitor.on('add', function (device) {
        if (device.hasOwnProperty('ID_VENDOR_ID') && (device.ID_VENDOR_ID == BIGREDBUTTON.ID.VENDOR_STRING)) {
          self.checkForControllers();
        }
      });
      // (Don't THINK the 'remove' event is relevant for us).
      // (Don't THINK the 'change' event is relevant for us).

      // Check for buttons right away, in case any are already connected.
      self.checkForControllers();
    });
  }
  util.inherits(ControllersDriver, events.EventEmitter);

  // Force-checks for instances of BigRedButtons.
  ControllersDriver.prototype.checkForControllers = function() {
    var self = this;

    var devices = usb.getDeviceList();
    for (var i = 0; i < devices.length; i++) {
      var deviceDesc = devices[i].deviceDescriptor;
      if ((deviceDesc.idVendor == BIGREDBUTTON.ID.VENDOR) && (deviceDesc.idProduct == BIGREDBUTTON.ID.PRODUCT)) {
        if (!bigredbuttons.hasOwnProperty(devices[i].deviceAddress)) {
          bigredbuttons[devices[i].deviceAddress] = new BigRedButtonController(devices[i]);
          addBigRedButtonCompoundEvents(bigredbuttons[devices[i].deviceAddress]);
          // Pass on the connected event.
          (function(button) {
            button.on('connected', function() {
              self.emit('connected', button);
            });
            // Pass on the disconnected event.
            button.on('disconnected', function() {
              self.emit('disconnected', button);
            });
          })(bigredbuttons[devices[i].deviceAddress]);
        }
      }
    }
  }

  /**
   * Helper function which augments the basic four events with some extra
   * compound ones.
   *
   * The basic four are:
   *
   *   - button-up
   *   - button-down
   *   - lid-up
   *   - lid-down
   *
   * And we add in:
   *
   *   - button-tap
   *   - button-long-press
   *   - button-double-tap
   *   - button-tap-press
   */
  function addBigRedButtonCompoundEvents(bigRedButton) {

    var lastEmitted = {};
    var longPressTimeoutID = null;

    var longPressDuration = 666;
    var standardDelay = 500;

    // Augment getControllerEvents() result to declare our extra
    // compound ones.
    var originalgetControllerEvents = bigRedButton.getControllerEvents;
    bigRedButton.getControllerEvents = function() {
      var events = originalgetControllerEvents();
      events['button-tap'] = {
        label: 'Button tap'
      };
      events['button-long-press'] = {
        label: 'Button long-press'
      };
      events['button-double-tap'] = {
        label: 'Button double-tap'
      };
      events['button-tap-press'] = {
        label: 'Button tap-press'
      };
      return events;
    }

    // Annnd now actually make em happen.

    // BUTTON DOWN might cause LONG PRESS
    bigRedButton.on('button-down', function() {
      lastEmitted['button-down'] = new Date();
      longPressTimeoutID = setTimeout(function() {
        bigRedButton.emit('button-long-press', {
          uuid: uuid.v4()
        });
      }, longPressDuration);
    });

    bigRedButton.on('disconnected', function() {
      if (longPressTimeoutID !== null) {
        clearTimeout(longPressTimeoutID);
        longPressTimeoutID = null;
      }
    });


    // BUTTON UP might cause BUTTON TAB (& cancels long press... maybe)
    bigRedButton.on('button-up', function() {
      if (longPressTimeoutID !== null) {
        clearTimeout(longPressTimeoutID);
        longPressTimeoutID = null;
      }
      if (lastEmitted['button-down'] && ((!lastEmitted['button-long-press']) || (lastEmitted['button-long-press'] < lastEmitted['button-down']))) {
        process.nextTick(function() {
          bigRedButton.emit('button-tap', {
            uuid: uuid.v4()
          });
        });
      }
    });

    // BUTTON TAP might cause BUTTON DOUBLE TAP.
    bigRedButton.on('button-tap', function() {
      if (lastEmitted['button-tap'] && (new Date() - lastEmitted['button-tap']) < standardDelay) {
        if ((!lastEmitted['button-double-tap']) || (new Date() - lastEmitted['button-double-tap']) > standardDelay) {
          process.nextTick(function() {
            bigRedButton.emit('button-double-tap', {
              uuid: uuid.v4()
            });
          });
        }
        else {
          // This is hacky..
          lastEmitted['button-double-tap'] = new Date();
        }
      }
      lastEmitted['button-tap'] = new Date();
    });

    // BUTTON LONG PRESS might cause a tap-press
    bigRedButton.on('button-long-press', function() {
      lastEmitted['button-long-press'] = new Date();
      if (lastEmitted['button-tap'] && (new Date() - lastEmitted['button-tap']) < (longPressDuration + standardDelay)) {
        process.nextTick(function() {
          bigRedButton.emit('button-tap-press', {
            uuid: uuid.v4()
          });
        });
      }
    });

    // BUTTON DOUBLE TAB
    bigRedButton.on('button-double-tap', function() {
      lastEmitted['button-double-tap'] = new Date();
    });
  }


  /**
   *  CONTROLLER 'INTERFACE'
   *
   *  EXTENDS
   *   EventEmitter
   *
   *  EVENTS
   *    <whatever>
   *
   *  METHODS
   *    1. getControllerEvents()
   *    2. getDisconnectionEventName()
   *    2. getUniqueID()
   *
   */
  function BigRedButtonController(device) {
    var self = this;
    events.EventEmitter.call(self);

    self._usb_device = device;

    try {
      device.open();
    }
    catch (error) {
      console.log(error);
      console.log(
"  The Big Red Button was found, but there was an error opening it for \n" +
"  communication. This is often because of insufficent permissions (try running \n" +
"  this again as Administrator/sudo), or because the OS has already reserved \n" +
"  this device elsewhere."
      );
      return;
    }

    var device_interface = device.interface(0);
    if (device_interface.isKernelDriverActive()) {
      device_interface.detachKernelDriver();
    }
    var device_endpoint = device_interface.endpoints[0];

    try {
      device_interface.claim();
    }
    catch (error) {
      console.log('There was an error claiming the Big Red Button interface.');
      console.log(error);
      return;
    }

    // Make sure we give it back when our process terminates!
    process.on('exit', function() {
      try {
        device_interface.release();
        device.close();
      }
      catch (error) {}
    });

    process.nextTick(function() {
      self.emit('connected');
    });

    var lid_open = null;
    var button_up = null;

    var listen = function() {

      // USB setup package. Equivalent to USB HID SET_REPORT I think.
      // See http://www.usb.org/developers/devclass_docs/usbcdc11.pdf
      try {
        device.controlTransfer(
          0x21,       // 0 01 000001: 'host-to-device' 'class' 'interface'
          0x09,       // SET_REPORT
          0x0200,     // report type: OUTPUT
          0,          // "wIndex is normally used to specify the referring
                      // interface for requests directed at the interface"
          new Buffer([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02]),
          function() {
            try {
              device_endpoint.transfer(device_endpoint.descriptor.wMaxPacketSize, function(error, data) {
                if (!error) {
                  var state = data[0];

                  var lid_open_now = ((state & BIGREDBUTTON.STATE.LID_OPEN) === BIGREDBUTTON.STATE.LID_OPEN);
                  if (lid_open !== null) {
                    if (lid_open_now && !lid_open) {
                      self.emit('lid-up', {
                        uuid: uuid.v4()
                      });
                    }
                    if (!lid_open_now && lid_open) {
                      self.emit('lid-down', {
                        uuid: uuid.v4()
                      });
                    }
                  }
                  var button_up_now = ((state & BIGREDBUTTON.STATE.BUTTON_UP) === BIGREDBUTTON.STATE.BUTTON_UP);
                  if (button_up !== null) {
                    if (button_up_now && !button_up) {
                      self.emit('button-up', {
                        uuid: uuid.v4()
                      });
                    }
                    if (!button_up_now && button_up) {
                      self.emit('button-down', {
                        uuid: uuid.v4()
                      });
                    }
                  }

                  lid_open = lid_open_now;
                  button_up = button_up_now;
                }
                // Infinite innit!
                // Older versions of node don't have setImmediate.
                (global['setImmediate'] || process.nextTick)(listen.bind(self));
              });
            }
            catch (error) {
              (global['setImmediate'] || process.nextTick)(listen.bind(self));
            }
          }
        );
      }
      catch (error) {
        self.emit('disconnected');
      }
    }

    process.nextTick(function() {
      listen.bind(self)();
    });
  }
  util.inherits(BigRedButtonController, events.EventEmitter);


  /**
   * Return a unique ID.
   *
   * @return {*}
   */
  BigRedButtonController.prototype.getUniqueID = function() {
    return this._usb_device.deviceAddress;
  }


  /**
   * We declare which of our events represent controller interactions.
   */
  BigRedButtonController.prototype.getControllerEvents = function() {
    return {
      'button-up': {
        label: 'Button up'
      },
      'button-down': {
        label: 'Button down'
      },
      'lid-up': {
        label: 'Lid up'
      },
      'lid-down': {
        label: 'Lid down'
      }
    }
  }


  /**
   * Which of our events is emitted on disconnection of the Big Red Button.
   */
  BigRedButtonController.prototype.getDisconnectionEventName = function() {
    return 'disconnected';
  }

  module.exports = new ControllersDriver();
})();
