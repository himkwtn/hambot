import { Injectable, BeforeApplicationShutdown } from '@nestjs/common';
import { Readable } from 'stream';
import { Message } from '../messages/messages.model';
import { TextChannel, VoiceChannel, StreamDispatcher } from 'discord.js';

const TIMEOUT_INTERVAL = 30000;
const DEFAULT_VOLUME = 0.2;
@Injectable()
export class AudioService implements BeforeApplicationShutdown {
  private _audioConnections = new Map<string, any>();
  private _leaveTimer = new Map<string, any>();
  private _channels = new Map<string, any>();

  async beforeApplicationShutdown() {
    [...this._channels.entries()].forEach(([, c]) => {
      (c as VoiceChannel).leave();
    });
  }

  private _volumes = new Map<string, number>();
  async playAudio(
    message: Message,
    stream: Readable,
    volume?: number,
    seek?: number,
    bitrate?: number,
    callback?: (err?: Error) => void,
  ): Promise<any> {
    switch (message.channel) {
      case 'discord':
        const guild = (message.messageChannel as TextChannel).guild;
        if (!guild) {
          throw new Error('Not in a guild');
        }
        if (this._leaveTimer.has(`discord: ${guild.id}`)) {
          clearTimeout(this._leaveTimer.get(`discord: ${guild.id}`));
        }
        if (this._audioConnections.get(`discord: ${guild.id}`)) {
          throw new Error('PLAYING');
        }
        const vc = (await guild.members.fetch(message.senderId)).voice
          .channelID;
        const channel = guild.channels.cache.find(
          (c) => c.id === vc,
        ) as VoiceChannel;
        const conn = await channel.join();
        this._channels.set(`discord: ${guild.id}`, channel);
        const player = conn.play(stream, {
          volume: this._volumes.has(`discord: ${guild.id}`)
            ? this._volumes.get(`discord: ${guild.id}`)
            : volume || DEFAULT_VOLUME,
          seek,
          bitrate,
        });
        stream.on('end', () => {
          this._audioConnections.delete(`discord: ${guild.id}`);
          this._channels.delete(`discord: ${guild.id}`);
          this._leaveTimer.set(
            `discord: ${guild.id}`,
            setTimeout(() => channel.leave(), TIMEOUT_INTERVAL),
          );
          callback && callback();
        });
        stream.on('skip', () => {
          console.log('skipping ?');
          this._audioConnections.delete(`discord: ${guild.id}`);
          this._channels.delete(`discord: ${guild.id}`);
          this._leaveTimer.set(
            `discord: ${guild.id}`,
            setTimeout(() => channel.leave(), TIMEOUT_INTERVAL),
          );

          callback && callback();
        });
        this._audioConnections.set(`discord: ${guild.id}`, player);
        return player;
        break;
    }
  }

  async changeVolume(message: Message, volume = 0.5) {
    switch (message.channel) {
      case 'discord':
        const guild = (message.messageChannel as TextChannel).guild;
        if (this._audioConnections.has(`discord: ${guild.id}`)) {
          (this._audioConnections.get(
            `discord: ${guild.id}`,
          ) as StreamDispatcher).setVolume(volume);
        }
        this._volumes.set(`discord: ${guild.id}`, volume);
    }
  }

  async stopPlaying(message: Message) {
    switch (message.channel) {
      case 'discord':
        const guild = (message.messageChannel as TextChannel).guild;
        if (this._audioConnections.has(`discord: ${guild.id}`)) {
          (this._audioConnections.get(
            `discord: ${guild.id}`,
          ) as StreamDispatcher).end();
        }
    }
  }
}
