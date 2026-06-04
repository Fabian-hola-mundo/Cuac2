import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TopbarComponent } from '../../layout/topbar/topbar.component';
import { FooterComponent } from '../../layout/footer/footer.component';
import { SeoService } from '../../core/services/seo.service';

@Component({
  selector: 'app-privacidad',
  standalone: true,
  imports: [RouterLink, TopbarComponent, FooterComponent],
  template: `
    <app-topbar />
    <main class="legal-page">
      <div class="legal-hero">
        <span class="eyebrow">Legal</span>
        <h1>Política de privacidad</h1>
        <p class="updated">Última actualización: junio de 2026</p>
      </div>
      <div class="legal-body">

        <h2><span class="sec-num">01</span> Responsable del tratamiento</h2>
        <p>
          <strong>Cuac Design</strong>, con domicilio en Bogotá D.C., Colombia, es responsable del
          tratamiento de los datos personales recolectados a través de cuac.design y la tienda
          Cuaquiverso, de conformidad con la <strong>Ley 1581 de 2012</strong> y el
          Decreto 1377 de 2013.
        </p>
        <p>
          Contacto del responsable: <a href="mailto:hola@cuacdesign.com">hola&#64;cuacdesign.com</a>
        </p>

        <h2><span class="sec-num">02</span> Datos que recolectamos</h2>
        <p>Dependiendo de la interacción, podemos recolectar:</p>
        <ul>
          <li><strong>Formulario de cotización:</strong> nombre, correo electrónico, teléfono y descripción del proyecto.</li>
          <li><strong>Checkout Cuaquiverso:</strong> nombre, correo electrónico, dirección de envío y datos necesarios para procesar el pago.</li>
          <li><strong>Navegación:</strong> datos de uso anónimos (páginas visitadas, tiempo de sesión) a través de herramientas de análisis.</li>
        </ul>

        <h2><span class="sec-num">03</span> Finalidad del tratamiento</h2>
        <ul>
          <li>Responder solicitudes de cotización y comunicarnos sobre proyectos.</li>
          <li>Procesar y gestionar pedidos de la tienda Cuaquiverso.</li>
          <li>Mejorar la experiencia del sitio web mediante análisis de uso.</li>
          <li>Cumplir con obligaciones legales y fiscales aplicables en Colombia.</li>
        </ul>

        <h2><span class="sec-num">04</span> Base legal del tratamiento</h2>
        <p>
          El tratamiento se realiza con base en el consentimiento del titular (al enviar un formulario
          o realizar una compra), en la ejecución de una relación contractual o en el cumplimiento
          de obligaciones legales.
        </p>

        <h2><span class="sec-num">05</span> Derechos del titular</h2>
        <p>
          De acuerdo con la Ley 1581 de 2012, el titular de los datos tiene derecho a:
        </p>
        <ul>
          <li>Conocer, actualizar y rectificar sus datos personales.</li>
          <li>Solicitar prueba de la autorización otorgada.</li>
          <li>Ser informado sobre el uso de sus datos.</li>
          <li>Revocar la autorización y solicitar la supresión de sus datos cuando no exista obligación legal de conservarlos.</li>
          <li>Acceder gratuitamente a sus datos personales.</li>
        </ul>
        <p>
          Para ejercer estos derechos, escríbenos a
          <a href="mailto:hola@cuacdesign.com">hola&#64;cuacdesign.com</a> con el asunto
          "Derechos HABEAS DATA".
        </p>

        <h2><span class="sec-num">06</span> Transferencia a terceros</h2>
        <p>
          Cuac Design no vende ni cede datos personales a terceros con fines comerciales. Podremos
          compartir datos estrictamente necesarios con proveedores de servicios de pago y logística
          que intervienen en el procesamiento de pedidos, quienes están obligados a tratarlos bajo
          estándares de confidencialidad equivalentes.
        </p>

        <h2><span class="sec-num">07</span> Tiempo de conservación</h2>
        <p>
          Los datos de pedidos se conservan durante 5 años en cumplimiento de obligaciones tributarias
          colombianas. Los datos de cotizaciones se conservan por 2 años desde el último contacto.
          Los datos de navegación anónimos no tienen límite de tiempo.
        </p>

        <h2><span class="sec-num">08</span> Seguridad</h2>
        <p>
          Implementamos medidas técnicas y organizativas razonables para proteger tus datos contra
          acceso no autorizado, pérdida o alteración. Las transacciones de pago se procesan a través
          de pasarelas seguras certificadas.
        </p>

        <h2><span class="sec-num">09</span> Cambios a esta política</h2>
        <p>
          Esta política puede actualizarse. La versión vigente siempre estará disponible en
          <a routerLink="/privacidad">cuac.design/privacidad</a>. Cambios relevantes serán comunicados
          por correo a quienes hayan realizado compras.
        </p>

      </div>
    </main>
    <app-footer />
  `,
})
export class PrivacidadComponent implements OnInit {
  private seo = inject(SeoService);

  ngOnInit(): void {
    this.seo.set({
      title: 'Política de privacidad — Cuac Design',
      description: 'Cómo Cuac Design recolecta, usa y protege tus datos personales, de acuerdo con la Ley 1581 de 2012.',
      canonical: 'https://cuacdesign.com/privacidad',
    });
  }
}
