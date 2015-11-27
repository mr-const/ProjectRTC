module.exports = function(io, streams) {

  io.on('connection', function(client) {
    console.log('-- ' + client.id + ' joined --');

    var iceServers = [
      "stun://stun.l.google.com:19302",
      "stun://stun1.l.google.com:19302",
      "stun://stun2.l.google.com:19302",
      "stun://stun3.l.google.com:19302",
      "stun://stun4.l.google.com:19302"
    ]

    var welcomeMessage = {
      id: client.id,
      ice_servers: iceServers
    }

    client.emit('welcome', JSON.stringify(welcomeMessage));

    client.on('message', function (data) {
      var message = JSON.parse(data)

      var otherClient = io.sockets.connected[message.to];

      console.log('-- Message from ' + client.id + ' to ' + message.to + ' --')

      if (!otherClient) {
        return;
      }
        delete message.to;
        message.from = client.id;
        otherClient.emit('message', JSON.stringify(message));
    });
      
    client.on('register_client', function(data) {
      var clientDescription = JSON.parse(data)
      console.log('-- ' + client.id + ' registered with name: ' + clientDescription.name + ' --');
      
      streams.addStream(client.id, clientDescription.name); 
    });
    
    client.on('update', function(options) {
      streams.update(client.id, options.name);
    });

    function leave() {
      console.log('-- ' + client.id + ' left --');
      streams.removeStream(client.id);
    }

    client.on('disconnect', leave);
    client.on('leave', leave);
  });
};