import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TopbarComponent } from '../../layout/topbar/topbar.component';
import { FooterComponent } from '../../layout/footer/footer.component';
import { SeoService } from '../../core/services/seo.service';

@Component({
  selector: 'app-terminos',
  standalone: true,
  imports: [RouterLink, TopbarComponent, FooterComponent],
  template: `
    <app-topbar />
    <main class="legal-page">
      <div class="legal-hero">
        <span class="eyebrow">Legal</span>
        <h1>Términos y condiciones</h1>
        <p class="updated">Última actualización: junio de 2026</p>
      </div>
      <div class="legal-body">

        <h2><span class="sec-num">01</span> Identificación del responsable</h2>
        <p>
          El presente sitio web, <strong>cuac.design</strong>, es operado por <strong>Cuac Design</strong>,
          estudio creativo con domicilio en Bogotá D.C., Colombia. Para consultas puede escribirnos a
          <a href="mailto:hola@cuacdesign.com">hola&#64;cuacdesign.com</a>.
        </p>

        <h2><span class="sec-num">02</span> Objeto y alcance</h2>
        <p>
          Estos términos regulan el uso del sitio web cuac.design y de la tienda en línea Cuaquiverso
          (cuac.design/cuaquiverso). Al navegar o realizar una compra, el usuario acepta estos términos
          en su totalidad.
        </p>

        <h2><span class="sec-num">03</span> Condiciones de uso del sitio</h2>
        <p>
          El usuario se compromete a utilizar el sitio de forma lícita y a no realizar acciones que
          puedan dañar, inutilizar o deteriorar el sitio o los servicios, ni interferir con su normal
          funcionamiento. Queda prohibida la reproducción total o parcial de los contenidos sin
          autorización expresa de Cuac Design.
        </p>

        <h2><span class="sec-num">04</span> Propiedad intelectual</h2>
        <p>
          Todos los contenidos del sitio —incluyendo textos, ilustraciones, logotipos, fotografías,
          diseños y código fuente— son propiedad de Cuac Design o están licenciados a su favor.
          Su reproducción, distribución o modificación sin autorización escrita constituye una
          infracción a los derechos de autor reconocidos en Colombia y en los tratados internacionales
          aplicables.
        </p>

        <h2><span class="sec-num">05</span> Condiciones de compra (Cuaquiverso)</h2>
        <p>
          Los productos de la tienda Cuaquiverso se producen en tirajes cortos. Los precios están
          expresados en pesos colombianos (COP) e incluyen IVA cuando aplique. Cuac Design se reserva
          el derecho de modificar precios, disponibilidad y características de los productos sin previo
          aviso. Un pedido queda confirmado únicamente cuando el pago ha sido procesado exitosamente.
        </p>
        <p>
          Para políticas de envío, cambios y devoluciones, el usuario puede escribir a
          <a href="mailto:hola@cuacdesign.com">hola&#64;cuacdesign.com</a>.
        </p>

        <h2><span class="sec-num">06</span> Limitación de responsabilidad</h2>
        <p>
          Cuac Design no garantiza la disponibilidad ininterrumpida del sitio y no será responsable
          por daños directos o indirectos derivados del uso o la imposibilidad de uso del mismo.
          Los contenidos se ofrecen "tal como están", sin garantías de ningún tipo.
        </p>

        <h2><span class="sec-num">07</span> Modificaciones</h2>
        <p>
          Cuac Design puede modificar estos términos en cualquier momento. Los cambios entran en
          vigor desde su publicación. El uso continuado del sitio tras una modificación implica la
          aceptación de los nuevos términos.
        </p>

        <h2><span class="sec-num">08</span> Ley aplicable</h2>
        <p>
          Estos términos se rigen por las leyes de la República de Colombia. Cualquier controversia
          será resuelta por los jueces competentes de Bogotá D.C.
        </p>

      </div>
    </main>
    <app-footer />
  `,
})
export class TerminosComponent implements OnInit {
  private seo = inject(SeoService);

  ngOnInit(): void {
    this.seo.set({
      title: 'Términos y condiciones — Cuac Design',
      description: 'Lee los términos y condiciones de uso del sitio web de Cuac Design y la tienda Cuaquiverso.',
      canonical: 'https://cuacdesign.com/terminos',
    });
  }
}
