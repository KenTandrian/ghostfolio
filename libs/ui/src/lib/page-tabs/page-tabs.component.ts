import { GfNavigationBarComponent } from '@ghostfolio/ui/navigation-bar';

import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterModule } from '@angular/router';

import { TabConfiguration } from './interfaces/interfaces';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GfNavigationBarComponent, MatTabsModule, RouterModule],
  selector: 'gf-page-tabs',
  styleUrls: ['./page-tabs.component.scss'],
  templateUrl: './page-tabs.component.html'
})
export class GfPageTabsComponent {
  public readonly tabs = input.required<TabConfiguration[]>();
}
