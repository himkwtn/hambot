import { Injectable } from '@nestjs/common';
import { AudioService } from 'src/modules/audio/audio.service';
import { DiscordMessage } from 'src/modules/messages/messages.model';
import ytdl, { videoInfo } from 'ytdl-core';
import Queue, { QueueWorker } from 'queue';
import { TextChannel } from 'discord.js';
import { Readable } from 'stream';

@Injectable()
export class YouTubeQueue {
  private _songQueue = new Map<string, Queue>();
  private _songTitleQueue = new Map<string, string[]>();
  private _streamMap = new Map<string, Readable>();
  constructor(private readonly audioService: AudioService) {}
  play(message: DiscordMessage, url: string, volume: number, meta: videoInfo) {
    const id = (message.messageChannel as TextChannel).guild.id;
    const job: QueueWorker = (cb) => {
      try {
        console.log('im running');
        const stream = ytdl(url);
        this._streamMap.set(id, stream);
        this.audioService
          .playAudio(message, stream, volume, undefined, undefined, cb)
          .catch(console.log);
        stream.on('error', (err) => {
          console.log(err);
          cb(err);
        });
        const remove = this._removeSongTitle.bind(this);
        stream.on('end', () => {
          console.log('done');
          remove(id);
        });
        stream.on('skip', () => {
          console.log('skipping ?');
        });
      } catch (e) {
        console.log(e);
        return e;
      }
    };
    this._addSongQueue(id, job);
    this._addSongTitle(id, meta.videoDetails.title);
    console.log(this._songTitleQueue.get(id));
    return this._songTitleQueue.get(id).join('\n');
  }

  skip(message: DiscordMessage) {
    const id = (message.messageChannel as TextChannel).guild.id;
    this._streamMap.get(id).emit('skip');
    this._streamMap.get(id).destroy();
    this._streamMap.delete(id);
    this._songQueue.get(id).shift();
    return this._removeSongTitle(id);
  }
  private _ensureQueue(id: string) {
    if (this._songQueue.has(id)) return;
    console.log('create new queue');
    this._songQueue.set(id, new Queue({ autostart: true, concurrency: 1 }));
  }
  private _addSongQueue(id: string, job: QueueWorker) {
    this._ensureQueue(id);
    this._songQueue.get(id).push(job);
  }
  private _addSongTitle(id: string, title: string) {
    if (!this._songTitleQueue.has(id)) {
      this._songTitleQueue.set(id, []);
    }
    this._songTitleQueue.get(id).push(title);
  }
  private _removeSongTitle(id: string) {
    return this._songTitleQueue.get(id).shift();
  }
}
