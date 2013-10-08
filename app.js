var bigRedButtonsDriver = require('./driver.js');
var util = require("util");

bigRedButtonsDriver.on('connected', function(bigRedButtonController) {
  console.log('Button connected! ' + bigRedButtonController.getUniqueID());

  var controllerEvents = bigRedButtonController.getControllerEvents();
  for (var event_name in controllerEvents) {
    if (controllerEvents.hasOwnProperty(event_name)) {
      (function(event_name, event){
        bigRedButtonController.on(event_name, function(context) {
          console.log(event.label);
          if (event_name == 'button-tap-press') {
            console.log(util.inspect(context, 100, 100));
          }
        });
      })(event_name, controllerEvents[event_name]);
    }
  }
});

bigRedButtonsDriver.on('disconnected', function(bigRedButtonController) {
  console.log('Button disconnected! ' + bigRedButtonController.getUniqueID());
});


return;

// ...elsewhere.
player1 = new Player();


//
var buttonDriver = require('./driver.js');
//button.listen();
var buttons = {
  one: null,
  two: null
}
buttonDriver.on('buttonConnected', function(button) {
  (function(){

    var player = thingy.getNextPlayerWithoutButton();

    button.on('pressed', function(){
      context.flashScreenAndIncrementScore();
    });

    button.on('disconnected', function(){
      context.flashScreenAndIncrementScore();
    });

  })();
//  if (!buttons.one) {
//    button.context = whatever;
//    buttons.one = button;
//  }
//  else {
//    button.context = whatever2;
//    buttons.two = button;
//  }
})


// Controller client code
var server = require('ourgameserverclient');

server.connect({uri: 'http://qwsdlkfjsdf.com'});

server.on('connected', function() {

  var buttonDriver = require('./driver.js');
  buttonDriver.on('buttonConnected', function(button) {
    server.newController(button.getControllerEventNames(), button.getDisconnectionEventName(), function(serverController) {
      button.onAll(function(eventName, params) {
        serverController.trigger(eventName, params);
      });
    });
  });

});