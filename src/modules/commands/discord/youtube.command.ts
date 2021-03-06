import { Injectable } from '@nestjs/common';
import { Message, DiscordMessage } from '../../messages/messages.model';
import { BaseCommand } from '../command.base';
import { DiscordService } from 'src/modules/discord/discord.service';
import ytdl from 'ytdl-core';
import ytsr from 'ytsr';
import { AudioService } from 'src/modules/audio/audio.service';
import { YouTubeQueue } from './yt-queue';

@Injectable()
export class YoutubeCommand extends BaseCommand {
  public command = /^(?:youtube|yt)(?: (volume|play|stop|skip)(?: (.*)?)?)?/i;
  public requiresAuth = false;
  public platforms = ['discord'];

  constructor(
    private discord: DiscordService,
    private audio: AudioService,
    private youtubeQueue: YouTubeQueue,
  ) {
    super();
  }
  async handle(
    message: DiscordMessage,
    command: string,
    url: string,
    volume?: string,
  ) {
    switch (command) {
      case 'play':
        if (!url) {
          return {
            files: [],
            message: `Please supply a url`,
          };
        }
        const vidUrl = /^http(s)?:\/\/(.*)/.test(url)
          ? url
          : ((await ytsr(url)).items.find(
              (e) => e.type === 'video',
            ) as ytsr.Video).url;
        const meta = await ytdl.getInfo(vidUrl);
        if (!meta) {
          return {
            files: [],
            message: `Video not found`,
          };
        }
        try {
          const queue = this.youtubeQueue.play(
            message,
            vidUrl,
            isNaN(Number(volume)) || Number(volume) > 1
              ? undefined
              : Number(volume),
            meta,
          );
          return {
            files: [],
            message: queue,
          };
        } catch (e) {
          console.log(e);
          if (e.message === 'PLAYING') {
            return {
              files: [],
              message: `Something is playing, we don't have queue. So either stop or wait lul`,
            };
          }
          return {
            files: [],
            message: `Something went wrong`,
          };
        }
      case 'skip':
        console.log('skipping');
        const song = this.youtubeQueue.skip(message);
        return {
          files: [],
          message: `Skipping ${song}`,
        };
      case 'stop':
        await this.audio.stopPlaying(message);
        return {
          files: [],
          message: `Stopped music`,
        };
      case 'volume':
        const vol = Number(url);
        if (isNaN(vol) || vol <= 0 || vol >= 1) {
          return {
            files: [],
            message: 'Invalid volume value ( only  0 - 1 )',
          };
        }
        await this.audio.changeVolume(message, vol);
        return {
          files: [],
          message: `Changed volume to ${Math.round(vol * 100)}%`,
        };
      default:
        return {
          files: [],
          message: 'Usage: stream <list|play|stop> index',
        };
    }
  }
}
