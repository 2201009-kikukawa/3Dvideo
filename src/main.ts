import {
  nowInSec,
  SkyWayAuthToken,
  SkyWayContext,
  SkyWayRoom,
  SkyWayStreamFactory,
  LocalVideoStream,
  uuidV4,
} from '@skyway-sdk/room';

import { canvas, update } from './module/three'; // VRMモデルと表情更新を行うメソッドをimport
import { appId, secret } from '../env';

const token = new SkyWayAuthToken({
  jti: uuidV4(),
  iat: nowInSec(),
  exp: nowInSec() + 60 * 60 * 24,
  scope: {
    app: {
      id: appId,
      turn: true,
      actions: ['read'],
      channels: [
        {
          id: '*',
          name: '*',
          actions: ['write'],
          members: [
            {
              id: '*',
              name: '*',
              actions: ['write'],
              publication: {
                actions: ['write'],
              },
              subscription: {
                actions: ['write'],
              },
            },
          ],
          sfuBots: [
            {
              actions: ['write'],
              forwardings: [
                {
                  actions: ['write'],
                },
              ],
            },
          ],
        },
      ],
    },
  },
}).encode(secret);

void (async () => {
  const localVideo = document.getElementById('local-video') as HTMLVideoElement;
  const buttonArea = document.getElementById('button-area');
  const remoteMediaArea = document.getElementById('remote-media-area');
  const channelNameInput = document.getElementById('channel-name') as HTMLInputElement;
  const myId = document.getElementById('my-id');
  const joinButton = document.getElementById('join');

  const { audio } = await SkyWayStreamFactory.createMicrophoneAudioAndCameraStream();

  // canvasを更新するメソッドの呼び出し
  update();

 //importしたcanvas要素からcaptureStream()を使ってStreamに変換
  const canvasStream = canvas.captureStream();
  const canvasTrack = canvasStream.getVideoTracks()[0];

  // Streamから取得したデータを使いlocalVideoStream型のインスタンスを作成
  const customVideoStream = new LocalVideoStream(canvasTrack);

  // localvideo要素のソースをcanvasから取得したStreamに変換
  localVideo.srcObject = canvasStream;
  await localVideo.play();

  joinButton.onclick = async () => {
    if (channelNameInput.value === '') return;

    const context = await SkyWayContext.Create(token);
    const channel = await SkyWayRoom.FindOrCreate(context, {
      type: 'sfu',
      name: channelNameInput.value,
    });
    const me = await channel.join();

    myId.textContent = me.id;

    await me.publish(audio);
    await me.publish(customVideoStream, {
      encodings: [
        { maxBitrate: 80_000, id: 'low' },
        { maxBitrate: 400_000, id: 'high' },
      ],
    });

    const subscribeAndAttach = (publication) => {
      if (publication.publisher.id === me.id) return;

      const subscribeButton = document.createElement('button');
      subscribeButton.textContent = `${publication.publisher.id}: ${publication.contentType}`;
      buttonArea.appendChild(subscribeButton);

      subscribeButton.onclick = async () => {
        const { stream, subscription } = await me.subscribe(publication.id);

        switch (stream.contentType) {
          case 'video':
            {
              const videoElm = document.createElement('video');
              videoElm.playsInline = true;
              videoElm.autoplay = true;
              stream.attach(videoElm);
              videoElm.onclick = () => {
                if (subscription.preferredEncoding === 'low') {
                  subscription.changePreferredEncoding('high');
                } else {
                  subscription.changePreferredEncoding('low');
                }
              };
              remoteMediaArea.appendChild(videoElm);

              // Canvasにリモートビデオを描画する
              const remoteContext = canvas.getContext('2d');
              function drawRemoteVideo() {
                if (videoElm.readyState === videoElm.HAVE_ENOUGH_DATA) {
                  remoteContext.drawImage(videoElm, 0, 0, canvas.width, canvas.height);
                }
                requestAnimationFrame(drawRemoteVideo);
              }
              drawRemoteVideo();
            }
            break;
          case 'audio':
            {
              const audioElm = document.createElement('audio');
              audioElm.controls = true;
              audioElm.autoplay = true;
              stream.attach(audioElm);
              remoteMediaArea.appendChild(audioElm);
            }
            break;
        }
      };
    };

    channel.publications.forEach(subscribeAndAttach);
    channel.onStreamPublished.add((e) => subscribeAndAttach(e.publication));
  };
})();
