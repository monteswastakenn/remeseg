import { Component, inject } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule, FormGroup } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { CommonModule } from '@angular/common';

import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    CardModule,
    InputTextModule,
    PasswordModule,
    ButtonModule,
    ToastModule
  ],
  providers: [MessageService],
  templateUrl: './login.html',
  styleUrls: ['./login.css'],
})
export class Login {
  loading = false;
  form!: FormGroup;
  logoClicks = 0;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private msg: MessageService
  ) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
    });
  }

  onLogoClick() {
    this.logoClicks++;
    if (this.logoClicks >= 5) {
      alert('catch u');
      this.logoClicks = 0;
    }
  }

  async submit(): Promise<void> {
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      this.msg.add({
        severity: 'warn',
        summary: 'Campos incompletos',
        detail: 'Completa email y contraseña.'
      });
      return;
    }

    const { email, password } = this.form.value;
    this.loading = true;

    const result = await this.auth.login(email, password);

    this.loading = false;

    if (result.statusCode !== 200) {
      this.msg.add({
        severity: 'error',
        summary: 'Acceso denegado',
        detail: 'Credenciales incorrectas o cuenta no verificada.'
      });
      return;
    }

    this.msg.add({
      severity: 'success',
      summary: 'Bienvenido',
      detail: 'Inicio de sesión correcto.'
    });

    setTimeout(() => this.router.navigate(['/home']), 800);
  }
}