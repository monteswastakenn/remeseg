import { Component } from '@angular/core';
import {
  FormBuilder, Validators, ReactiveFormsModule, FormGroup, AbstractControl, ValidationErrors
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { DividerModule } from 'primeng/divider';
import { MessageService } from 'primeng/api';
import { CommonModule } from '@angular/common';

import { AuthService } from '../../../services/auth.service';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const pass = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return pass === confirm ? null : { mismatch: true };
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CardModule,
    InputTextModule,
    PasswordModule,
    ButtonModule,
    ToastModule,
    DividerModule,
    RouterLink
  ],
  providers: [MessageService],
  templateUrl: './register.html',
  styleUrls: ['./register.css'],
})
export class Register {
  loading = false;
  form!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private msg: MessageService
  ) {
    this.form = this.fb.group(
      {
        fullName: ['', Validators.required],
        username: ['', Validators.required],
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(6)]],
        confirmPassword: ['', Validators.required],
      },
      { validators: passwordsMatch }
    );
  }

  async submit(): Promise<void> {
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      this.msg.add({
        severity: 'warn',
        summary: 'Formulario inválido',
        detail: 'Revisa todos los campos.'
      });
      return;
    }

    const { email, password, fullName, username } = this.form.value;
    this.loading = true;

    const result = await this.auth.register(email, password, fullName, username);

    this.loading = false;

    if (result.statusCode !== 201) {
      this.msg.add({
        severity: 'error',
        summary: 'Error al registrar',
        detail: 'Ocurrió un error inesperado.'
      });
      return;
    }

    this.msg.add({
      severity: 'success',
      summary: 'Registro exitoso',
      detail: 'Revisa tu correo para confirmar tu cuenta.'
    });

    setTimeout(() => this.router.navigate(['/login']), 1500);
  }
}