import { Component, Input } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { MatChipsModule } from '@angular/material/chips';

@Component({
  imports: [MatChipsModule],
  selector: 'gf-predefined-fee',
  templateUrl: './predefined-fee.component.html'
})
export class GfPredefinedFeeComponent {
  @Input() activityForm: FormGroup;

  public predefinedFee(percentage: number) {
    const total =
      this.activityForm.get('quantity').value *
      this.activityForm.get('unitPrice').value;
    this.activityForm.get('fee').setValue(total * percentage);
  }
}
