import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { SharedModule } from 'primeng/api';

@Component({
  selector: 'app-landing',
  imports: [RouterLink, CardModule, ButtonModule, SharedModule],
  templateUrl: './landing.html',
  styleUrl: './landing.css',
  standalone: true,
})
export class Landing {

}
