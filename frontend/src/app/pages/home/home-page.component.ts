import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { weddingData } from '../../data/wedding-data';
import { MediaService } from '../../services/media.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home-page.component.html',
  styleUrls: ['./home-page.component.scss']
})
export class HomePageComponent {
  private readonly mediaService = inject(MediaService);

  readonly title = weddingData.couple.names;
  readonly shortName = weddingData.couple.short;
  readonly weddingDate = weddingData.couple.date;
  readonly headline = weddingData.couple.headline;
  readonly subtitle = weddingData.couple.subtitle;
  readonly confirmEmail = weddingData.couple.confirmEmail;
  readonly location = weddingData.location;
  readonly rsvp = weddingData.rsvp;
  readonly highlights = weddingData.highlights;
  readonly story = weddingData.story;
  readonly timeline = weddingData.timeline;
  readonly gallery = weddingData.gallery.length ? weddingData.gallery : this.mediaService.getGallery();

  readonly rsvpInviteUrl = '/rsvp/familia-demo';

  getImageUrl(url?: string): string {
    return this.mediaService.getImageUrl(url);
  }
}
