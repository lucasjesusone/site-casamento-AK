import { Routes } from '@angular/router';
import { HomePageComponent } from '../pages/home/home-page.component';
import { AdminPageComponent } from '../pages/admin/admin-page.component';

export const routes: Routes = [
  {
    path: '',
    component: HomePageComponent
  },
{
    path: 'admin',
    component: AdminPageComponent
  }
];
