import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule, FormGroup } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { DividerModule } from 'primeng/divider';
import { MessageModule } from 'primeng/message';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { MessageService, SharedModule } from 'primeng/api';
import { CommonModule } from '@angular/common';

import { AuthService } from '../../../services/auth.service';
import { RateLimiterService, RATE_LIMITS } from '../../../services/rate-limiter.service';

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
    ToastModule,
    DividerModule,
    MessageModule,
    InputGroupModule,
    InputGroupAddonModule,
    SharedModule
  ],
  providers: [MessageService],
  templateUrl: './login.html',
  styleUrls: ['./login.css'],
})
export class Login implements OnInit, OnDestroy {
  loading = false;
  form!: FormGroup;
  logoClicks = 0;

  // ── Rate Limit UI ───────────────────────────────────────────────
  isBlocked = false;
  countdown = 0;          // segundos restantes
  attemptsLeft = RATE_LIMITS.LOGIN.maxAttempts; // intentos antes de bloqueo
  private countdownInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private msg: MessageService,
    private rateLimiter: RateLimiterService
  ) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
    });
  }

  ngOnInit(): void {
    // Al cargar la página, revisar si ya estaba bloqueado
    const status = this.rateLimiter.check('login', RATE_LIMITS.LOGIN);
    if (status.isBlocked) {
      this.startCountdown(status.retryAfterSeconds);
    }
  }

  ngOnDestroy(): void {
    this.clearCountdown();
  }

  onLogoClick() {
    this.logoClicks++;
    if (this.logoClicks >= 5) {
      alert('catch u');
      this.logoClicks = 0;
    }
  }

  async submit(): Promise<void> {
    if (this.isBlocked) return;

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

    // 429 = bloqueado por rate limit
    if (result.statusCode === 429) {
      const status = this.rateLimiter.check('login', RATE_LIMITS.LOGIN);
      this.startCountdown(status.retryAfterSeconds);
      return;
    }

    if (result.statusCode !== 200) {
      // Revisar cuántos intentos quedan
      const status = this.rateLimiter.check('login', RATE_LIMITS.LOGIN);
      this.attemptsLeft = status.attemptsRemaining;

      if (status.isBlocked) {
        this.startCountdown(status.retryAfterSeconds);
      } else {
        this.msg.add({
          severity: 'error',
          summary: 'Acceso denegado',
          detail: status.attemptsRemaining > 0
            ? `Credenciales incorrectas. Te quedan ${status.attemptsRemaining} intento(s).`
            : 'Último intento. El siguiente bloqueo estará activo.'
        });
      }
      return;
    }

    this.msg.add({
      severity: 'success',
      summary: 'Bienvenido',
      detail: 'Inicio de sesión correcto.'
    });

    setTimeout(() => this.router.navigate(['/home']), 800);
  }

  // ── Inicia el contador regresivo visible ─────────────────────────
  private startCountdown(seconds: number): void {
    this.isBlocked = true;
    this.countdown = seconds;
    this.form.disable();
    this.clearCountdown();

    this.countdownInterval = setInterval(() => {
      this.countdown--;
      if (this.countdown <= 0) {
        this.clearCountdown();
        this.isBlocked = false;
        this.attemptsLeft = RATE_LIMITS.LOGIN.maxAttempts;
        this.form.enable();
      }
    }, 1000);
  }

  private clearCountdown(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }
}