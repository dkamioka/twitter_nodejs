/**
* Module loading
*/

var express = require('express')
  , io = require('socket.io')
  , http = require('http')
  , twitter = require('ntwitter')
  , cronJob = require('cron').CronJob
  , _ = require('underscore')
  , path = require('path');

// Create the express app
var app = express();

// Create the HTTP server with the express app
var server = http.createServer(app);

// List of string to search for.

var watchHashTags = ['cpbr7'];

var watchList = {
  total: 0,
  hashtags: {}
};

_.each(watchHashTags, function(v) { watchList.hashtags[v] = 0; });

// Express Setup

app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(app.router);
app.use(require('stylus').middleware(__dirname + '/public'));
app.use(express.static(path.join(__dirname, 'public')));

//We're using bower components so add it to the path to make things easier
app.use('/components', express.static(path.join(__dirname, 'components')));
 
// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

//Our only route! Render it with the current watchList
app.get('/', function(req, res) {
    res.render('index', { data: watchList });
});

//Start a Socket.IO listen
var sockets = io.listen(server);
 
//Set the sockets.io configuration.
//THIS IS NECESSARY ONLY FOR HEROKU!
// sockets.configure(function() {
//   sockets.set('transports', ['xhr-polling']);
//   sockets.set('polling duration', 10);
// });
 
//If the client just connected, give them fresh data!
sockets.sockets.on('connection', function(socket) { 
    socket.emit('data', watchList);
});

//Instantiate the twitter component
//You will need to get your own key. Don't worry, it's free. But I cannot provide you one
//since it will instantiate a connection on my behalf and will drop all other streaming connections.
//Check out: https://dev.twitter.com/
var t = new twitter({
    consumer_key: process.env.TWITTER_CONS_KEY,           // <--- FILL ME IN
    consumer_secret: process.env.TWITTER_CONS_SEC,        // <--- FILL ME IN
    access_token_key: process.env.TWITTER_ACC_KEY,       // <--- FILL ME IN
    access_token_secret: process.env.TWITTER_ACC_SEC     // <--- FILL ME IN
});
 
//Tell the twitter API to filter on the watchSymbols 
t.stream('statuses/filter', { track: watchHashTags }, function(stream) {
  stream.on('error', function(error, code) { console.log("My error: " + error + ": " + code); });
  //We have a connection. Now watch the 'data' event for incomming tweets.
  stream.on('data', function(tweet) {
 
    //This variable is used to indicate whether a symbol was actually mentioned.
    //Since twitter doesnt why the tweet was forwarded we have to search through the text
    //and determine which symbol it was ment for. Sometimes we can't tell, in which case we don't
    //want to increment the total counter...
    var claimed = false;
 
    //Make sure it was a valid tweet
    if (tweet.text !== undefined) {
 
      //We're gunna do some indexOf comparisons and we want it to be case agnostic.
      var text = tweet.text.toLowerCase();
 
      //Go through every symbol and see if it was mentioned. If so, increment its counter and
      //set the 'claimed' variable to true to indicate something was mentioned so we can increment
      //the 'total' counter!
      _.each(watchHashTags, function(v) {
          if (text.indexOf(v.toLowerCase()) !== -1) {
              watchList.hashtags[v]++;
              claimed = true;
              console.log("#" + v + ": " + text);//JSON.stringify(tweet, null, 4));
              console.log("Quantidade: " + watchList.hashtags[v]);
          }
      });
 
      //If something was mentioned, increment the total counter and send the update to all the clients
      if (claimed) {
          //Increment total
          watchList.total++;
 
          //Send to all the clients
          sockets.sockets.emit('data', watchList);
      }
    }
  });
});

//Create the server
server.listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});