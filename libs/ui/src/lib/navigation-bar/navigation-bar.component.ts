import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input
} from '@angular/core';
import { MatRippleModule } from '@angular/material/core';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterModule } from '@angular/router';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { openOutline } from 'ionicons/icons';
import { DeviceDetectorService } from 'ngx-device-detector';

import { NavigationBarItem } from './interfaces/interfaces';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonIcon,
    MatRippleModule,
    MatTabsModule,
    NgTemplateOutlet,
    RouterModule
  ],
  selector: 'gf-navigation-bar',
  styleUrls: ['./navigation-bar.component.scss'],
  templateUrl: './navigation-bar.component.html'
})
export class GfNavigationBarComponent {
  public deviceType: string;
  public readonly items = input.required<NavigationBarItem[]>();

  private readonly deviceService = inject(DeviceDetectorService);

  public constructor() {
    this.deviceType = this.deviceService.getDeviceInfo().deviceType;

    addIcons({ openOutline });
  }
}
