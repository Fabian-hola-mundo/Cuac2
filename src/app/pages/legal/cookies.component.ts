import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TopbarComponent } from '../../layout/topbar/topbar.component';
import { FooterComponent } from '../../layout/footer/footer.component';
import { SeoService } from '../../core/services/seo.service';

@Component({
  selector: 'app-cookies',
  standalone: true,
  imports: [RouterLink, TopbarComponent, FooterComponent],
  template: `
    <app-topbar />
    <main class="legal-page">
      <div class="legal-hero">
        <span class="eyebrow">Legal</span>
        <h1>Política de cookies</h1>
        <p class="updated">Última actualización: junio de 2026</p>
      </div>
      <div class="legal-body">

        <h2><span class="sec-num">01</span> ¿Qué son las cookies?</h2>
        <p>
          Las cookies son pequeños archivos de texto que un sitio web almacena en tu navegador o
          dispositivo cuando lo visitas. Permiten que el sitio recuerde tus acciones y preferencias
          durante un período de tiempo para que no tengas que volver a introducirlas cada vez que
          regresas al sitio o navegas entre páginas.
        </p>

        <h2><span class="sec-num">02</span> Cookies que usamos</h2>

        <p><strong>Funcionales</strong></p>
        <ul>
          <li>
            <strong>Carrito de compras (Cuaquiverso):</strong> guardamos los productos añadidos al
            carrito en <code>localStorage</code> para que no se pierdan al navegar entre páginas.
            Esta información permanece en tu dispositivo y no se envía a nuestros servidores.
          </li>
        </ul>

        <p><strong>De preferencia</strong></p>
        <ul>
          <li>
            <strong>cookie_consent:</strong> almacenamos tu decisión sobre el uso de cookies
            (aceptado / rechazado) en <code>localStorage</code> para no mostrarte el aviso
            nuevamente.
          </li>
        </ul>

        <p><strong>Analíticas</strong></p>
        <ul>
          <li>
            Si usamos herramientas de análisis de tráfico web (como Google Analytics), estas pueden
            establecer cookies para medir el comportamiento de navegación de forma anónima y
            agregada. Nunca se recolectan datos que permitan identificarte directamente.
          </li>
        </ul>

        <h2><span class="sec-num">03</span> Cookies de terceros</h2>
        <p>
          Las pasarelas de pago que usamos en Cuaquiverso pueden establecer sus propias cookies
          durante el proceso de checkout. Estas cookies están sujetas a las políticas de privacidad
          de los respectivos proveedores.
        </p>

        <h2><span class="sec-num">04</span> Cómo gestionar las cookies</h2>
        <p>
          Puedes configurar tu navegador para bloquear o eliminar cookies. Aquí tienes instrucciones
          para los navegadores más comunes:
        </p>
        <ul>
          <li><strong>Chrome:</strong> Ajustes → Privacidad y seguridad → Cookies y otros datos de sitios.</li>
          <li><strong>Firefox:</strong> Ajustes → Privacidad y seguridad → Cookies y datos del sitio.</li>
          <li><strong>Safari:</strong> Preferencias → Privacidad → Gestionar datos del sitio web.</li>
          <li><strong>Edge:</strong> Configuración → Cookies y permisos del sitio → Cookies y datos guardados.</li>
        </ul>
        <p>
          Ten en cuenta que bloquear ciertas cookies puede afectar el funcionamiento de la tienda
          Cuaquiverso (por ejemplo, el carrito de compras).
        </p>

        <h2><span class="sec-num">05</span> Más información</h2>
        <p>
          Para más detalles sobre cómo tratamos tus datos personales, consulta nuestra
          <a routerLink="/privacidad">Política de privacidad</a>. Si tienes preguntas, escríbenos a
          <a href="mailto:hola@cuacdesign.com">hola&#64;cuacdesign.com</a>.
        </p>

      </div>
    </main>
    <app-footer />
  `,
})
export class CookiesComponent implements OnInit {
  private seo = inject(SeoService);

  ngOnInit(): void {
    this.seo.set({
      title: 'Política de cookies — Cuac Design',
      description: 'Qué cookies usa Cuac Design y cómo puedes gestionarlas en tu navegador.',
      canonical: 'https://cuacdesign.com/cookies',
    });
  }
}
