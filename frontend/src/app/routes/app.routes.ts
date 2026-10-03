import { Routes } from '@angular/router';
import { HomePageComponent } from '../pages/home/home-page.component';
import { RsvpPageComponent } from '../pages/rsvp/rsvp-page.component';
import { AdminPageComponent } from '../pages/admin/admin-page.component';

export const routes: Routes = [
  {
    path: '',
    component: HomePageComponent
  },
  {
    path: 'rsvp/:token',
    component: RsvpPageComponent
  },
  {
    path: 'admin',
    component: AdminPageComponent
  }
];
