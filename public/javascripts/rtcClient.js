var PeerManager = (function () {

    var localId,
        config = {
            peerConnectionConfig: {
                iceServers: [
                    // will now receive list from server with welcome message
                    // {"url": "stun:23.21.150.121"},
                    // {"url": "stun:stun.l.google.com:19302"}
                ]
            },
            controlDataChannelName: "control_data_channel"
        },
        peerDatabase = {},
        localStream,
        remoteVideoContainer = document.getElementById('remoteVideosContainer'),
        socket = io();

    function mediaConstraints() {
        var streamAvailable = !!localStream
        return {
            mandatory: {
                OfferToReceiveAudio: true,
                OfferToReceiveVideo: true
            },
            optional: [
                {DtlsSrtpKeyAgreement: true},
                {'enable-sctp-data-channels': true}
            ]
        }
    }

    socket.on('message', handleMessage);
    socket.on('welcome', function (data) {
        json = JSON.parse(data);
        localId = json.id;
        config.peerConnectionConfig.iceServers = json.ice_servers.map(function (x) {
            return {"url": x};
        });

        console.log("Connected. ID: " + localId);
        console.log("iceServers: " + JSON.stringify(config.peerConnectionConfig.iceServers));
    });

    function addPeer(remoteId) {
        var peer = new Peer(config.peerConnectionConfig, mediaConstraints());
        peer.pc.onicecandidate = function (event) {
            if (event.candidate) {
                send('candidate', remoteId, {
                    label: event.candidate.sdpMLineIndex,
                    id: event.candidate.sdpMid,
                    candidate: event.candidate.candidate
                });
            }
        };
        peer.pc.onaddstream = function (event) {
            attachMediaStream(peer.remoteVideoEl, event.stream);
            remoteVideosContainer.appendChild(peer.remoteVideoEl);
        };
        peer.pc.onremovestream = function (event) {
            peer.remoteVideoEl.src = '';
            remoteVideosContainer.removeChild(peer.remoteVideoEl);
        };
        peer.pc.oniceconnectionstatechange = function (event) {
            var state = (event.srcElement // Chrome
                      || event.target) // Firefox
                .iceConnectionState
            console.log('ICE connection state changed to ' + state)
            switch (state) {
                case 'disconnected':
                    remoteVideosContainer.removeChild(peer.remoteVideoEl);
                    if (peer.dc) {
                        peer.dc.close();
                        delete peer.dc;
                    }
                    break;
            }
        };
        peer.pc.ondatachannel = function (event) {
            if (event.channel.label != config.controlDataChannelName) {
                console.log('Unexpected data channel ' + event.channel.label)
                return
            }
            console.log('Received control data channel')
            peer.dc = event.channel
            initDataChannel(peer.dc)
        };
        peerDatabase[remoteId] = peer;

        return peer;
    }

    function answer(remoteId) {
        var pc = peerDatabase[remoteId].pc;
        pc.createAnswer(
            function (sessionDescription) {
                pc.setLocalDescription(sessionDescription);
                send('answer', remoteId, sessionDescription);
            },
            error,
            mediaConstraints()
        );
    }

    function offer(remoteId) {
        var pc = peerDatabase[remoteId].pc;
        createControlChannel(remoteId)
        pc.createOffer(
            function (sessionDescription) {
                pc.setLocalDescription(sessionDescription);
                send('offer', remoteId, sessionDescription);
            },
            error,
            mediaConstraints()
        );
    }

    function createControlChannel(remoteId) {
        var peer = peerDatabase[remoteId]
        var dataChannelConfig = {
            id: 0,
            maxRetransmits: 0
        }
        peer.dc = peer.pc.createDataChannel(config.controlDataChannelName, dataChannelConfig)
        console.log('Creating control data channel')
        initDataChannel(peer.dc)
    }

    function initDataChannel(channel) {
        channel.onmessage = function (event) {
            console.log('Received message' + event.data)
        };
        channel.onopen = function () {
            console.log('Channel ' + channel.label + ' opened')
        };
        channel.onclose = function () {
            console.log('Channel ' + channel.label + ' closed')
        };
    }

    function handleMessage(jsonMessage) {
        var message = JSON.parse(jsonMessage);
        var type = message.type,
            from = message.from,
            pc = (peerDatabase[from] || addPeer(from)).pc;

        console.log('received ' + type + ' from ' + from);

        switch (type) {
            case 'init':
                toggleLocalStream(pc);
                offer(from);
                break;
            case 'offer':
                var sessionDescription = new RTCSessionDescription({
                    type: 'offer',
                    sdp: message.payload.sdp
                })
                pc.setRemoteDescription(sessionDescription, function () {
                }, error);
                answer(from);
                break;
            case 'answer':
                var sessionDescription = new RTCSessionDescription({
                    type: 'answer',
                    sdp: message.payload.sdp
                })
                pc.setRemoteDescription(sessionDescription, function () {
                }, error);
                break;
            case 'candidate':
                if (pc.remoteDescription) {
                    pc.addIceCandidate(new RTCIceCandidate({
                        sdpMLineIndex: message.payload.label,
                        sdpMid: message.payload.id,
                        candidate: message.payload.candidate
                    }), function () {
                    }, error);
                }
                break;
        }
    }

    function send(type, to, payload) {
        console.log('sending ' + type + ' to ' + to);

        socket.emit('message', JSON.stringify({
            to: to,
            type: type,
            payload: payload
        }));
    }

    function toggleLocalStream(pc) {
        if (localStream) {
            (!!pc.getLocalStreams().length) ? pc.removeStream(localStream) : pc.addStream(localStream);
        }
    }

    function sendControlMessage(remoteId, message) {
        peer = peerDatabase[remoteId]

        if (!peer.dc || peer.dc.readyState != 'open') {
            console.log('Attempt to send control message to peer without being connected to it')
            return
        }

        peer.dc.send(message)
    }

    function error(err) {
        console.log(err);
    }

    return {
        getId: function () {
            return localId;
        },

        setLocalStream: function (stream) {

            // if local cam has been stopped, remove it from all outgoing streams.
            if (!stream) {
                for (id in peerDatabase) {
                    pc = peerDatabase[id].pc;
                    if (!!pc.getLocalStreams().length) {
                        pc.removeStream(localStream);
                        offer(id);
                    }
                }
            }

            localStream = stream;
        },

        toggleLocalStream: function (remoteId) {
            peer = peerDatabase[remoteId] || addPeer(remoteId);
            toggleLocalStream(peer.pc);
        },

        peerInit: function (remoteId) {
            peer = peerDatabase[remoteId] || addPeer(remoteId);
            //§send('init', remoteId, null);
            offer(remoteId);
        },

        peerRenegotiate: function (remoteId) {
            offer(remoteId);
        },

        send: function (type, payload) {
            socket.emit(type, payload);
        },

        sendControlMessage: function (remoteId, message) {
            peer = peerDatabase[remoteId] || addPeer(remoteId)
            sendControlMessage(remoteId, message)
        }
    };

});

var Peer = function (pcConfig, pcConstraints) {
    this.pc = new RTCPeerConnection(pcConfig, pcConstraints);
    this.remoteVideoEl = document.createElement('video');
    this.remoteVideoEl.controls = true;
    this.remoteVideoEl.autoplay = true;
}