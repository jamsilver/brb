var bigRedButtonsDriver = require('./driver.js');
bigRedButtonsDriver.on('connected', function(bigRedButtonController) {
  console.log('Button connected! ' + bigRedButtonController.getUniqueID());

  bigRedButtonController.on('lid-opened', function() {
    console.log('LID opened');
  });
  bigRedButtonController.on('lid-closed', function() {
    console.log('LID closed');
  });
  bigRedButtonController.on('button-up', function() {
    console.log('BUTTON up');
  });
  bigRedButtonController.on('button-down', function() {
    console.log('BUTTON down');
  });
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