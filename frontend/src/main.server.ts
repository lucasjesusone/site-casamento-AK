import { bootstrapApplication } from '@angular/platform-browser';
import { HomePageComponent } from './app/pages/home/home-page.component';
import { config } from './app/app.config.server';

const bootstrap = () => bootstrapApplication(HomePageComponent, config);

export default bootstrap;
