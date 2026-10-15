import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Injector,
  input,
  OnInit,
  Signal
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormGroup } from '@angular/forms';
import { MatChipsModule } from '@angular/material/chips';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  arrowDownCircleOutline,
  arrowUpCircleOutline
} from 'ionicons/icons';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonIcon, MatChipsModule],
  selector: 'gf-predefined-fee',
  templateUrl: './predefined-fee.component.html'
})
export class GfPredefinedFeeComponent implements OnInit {
  public activityForm = input.required<FormGroup>();

  private readonly injector = inject(Injector);
  private formValues!: Signal<Record<string, any>>;

  public isDisabled = computed(() => {
    if (!this.formValues) {
      const form = this.activityForm();
      return !form.get('unitPrice')?.value || !form.get('quantity')?.value;
    }
    const values = this.formValues();
    return !values?.unitPrice || !values?.quantity;
  });

  public constructor() {
    addIcons({ arrowDownCircleOutline, arrowUpCircleOutline });
  }

  public ngOnInit() {
    const form = this.activityForm();
    this.formValues = toSignal(form.valueChanges, {
      initialValue: form.value,
      injector: this.injector
    });
  }

  public predefinedFee(percentage: number) {
    if (this.isDisabled()) {
      return;
    }

    const form = this.activityForm();
    const quantity = form.get('quantity')?.value ?? 0;
    const unitPrice = form.get('unitPrice')?.value ?? 0;
    const total = quantity * unitPrice;

    form.get('fee')?.setValue(Number((total * percentage).toFixed(2)));
    form.get('fee')?.markAsDirty();
  }
}
