module.exports = function() {
  /**
   * available streams 
   * the id value is considered unique (provided by socket.io)
   */
  var streamList = [];

  /**
   * Stream object
   */
  var Stream = function(id, name) {
    this.name = name;
    this.id = id;
  }

  return {
    addStream : function(id, name) {
      var index = 0;
      while(index < streamList.length && streamList[index].id != id){
        index++;
      }
      if (index < streamList.length) {
          console.log('--- Attempt to add duplicate stream with id: ' + id + ' name: ' + name + ' ---')
          //this.update(id, name)
          return
      }
      var stream = new Stream(id, name);
      streamList.push(stream);
      console.log('--- added stream with id: ' + id + ' name: ' + name + ' ---');
      console.log(streamList);
    },

    removeStream : function(id) {
      var index = 0;
      while(index < streamList.length && streamList[index].id != id){
        index++;
      }
      console.log(streamList);
      streamList.splice(index, 1);
      console.log('--- removed stream with id: ' + id + '  index: ' + index);
      console.log(streamList);
    },

    // update function
    update : function(id, name) {
      var stream = streamList.find(function(element, i, array) {
        return element.id == id;
      });
      stream.name = name;
    },

    getStreams : function() {
      return streamList;
    }
  }
};
