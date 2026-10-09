import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TopbarComponent } from '../../layout/topbar/topbar.component';
import { FooterComponent } from '../../layout/footer/footer.component';
import { SeoService } from '../../core/services/seo.service';

/**
 * Versión para el visitante: qué se recoge en cada parte del sitio, para qué y
 * con quién se comparte. Lo formal de la Ley 1581 (procedimientos, plazos,
 * deberes) vive en /tratamiento-datos para no repetirlo aquí.
 *
 * Si se agrega un formulario, un proveedor o una herramienta de análisis, esta
 * página tiene que cambiar con él.
 */
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
        <p class="updated">Última actualización: 5 de octubre de 2026</p>
      </div>
      <div class="legal-body">

        <p>
          En Cuac Design nos tomamos en serio lo que nos cuentas. Esta política explica, en palabras
          sencillas, qué datos recogemos en <strong>cuacdesign.com</strong> y en la tienda
          <strong>Cuaquiverso</strong>, para qué los usamos, con quién los compartimos y cómo puedes
          controlarlos. Las reglas formales, los plazos y el procedimiento para ejercer tus derechos
          están en nuestra
          <a routerLink="/tratamiento-datos">Política de tratamiento de datos personales</a>,
          que hace parte de este documento.
        </p>

        <h2><span class="sec-num">01</span> Quién es responsable de tus datos</h2>
        <p>
          <strong>Cuac Design</strong>, estudio creativo con domicilio en Bogotá D.C., Colombia, es
          el responsable del tratamiento de los datos personales que recoge este sitio, de acuerdo con
          la <strong>Ley 1581 de 2012</strong> y el Decreto 1074 de 2015 (que incorpora el Decreto
          1377 de 2013).
        </p>
        <p>
          Para cualquier asunto relacionado con tus datos escríbenos a
          <a href="mailto:hola@cuacdesign.com">hola&#64;cuacdesign.com</a>.
        </p>

        <h2><span class="sec-num">02</span> Qué datos recogemos y dónde</h2>
        <p>Solo recogemos lo que necesitamos para lo que nos pides. Según lo que hagas en el sitio:</p>
        <ul>
          <li>
            <strong>Compras en Cuaquiverso:</strong> nombre y apellido, correo electrónico, celular,
            tipo y número de documento, dirección de envío (departamento, ciudad, dirección, barrio y
            código postal), la nota que quieras dejar en el pedido, los productos comprados, el código
            de descuento si usaste uno y el estado del pago.
          </li>
          <li>
            <strong>Cotizador:</strong> nombre, correo electrónico, empresa, teléfono o WhatsApp
            (opcional), los servicios que te interesan, la descripción de tu proyecto, el presupuesto y
            el plazo que indiques, y el rango estimado que te mostró el cotizador.
          </li>
          <li>
            <strong>Mensajes del Cuaquiverso:</strong> el tipo de mensaje, lo que escribas y tu correo
            solo si decides dejarlo para que te respondamos.
          </li>
          <li>
            <strong>Reseñas:</strong> nombre, cargo o empresa (opcional), tu comentario y, si quieres,
            tu correo.
          </li>
          <li>
            <strong>Navegación:</strong> si aceptas las cookies de análisis, Google Analytics registra
            de forma agregada las páginas que visitas, el tiempo de la visita, el tipo de dispositivo y
            navegador y tu ubicación aproximada.
          </li>
        </ul>
        <p>
          <strong>No vemos ni guardamos los datos de tu tarjeta ni de tu cuenta bancaria.</strong>
          El pago lo procesa directamente Bold, nuestra pasarela de pagos; nosotros solo recibimos la
          confirmación de si el pago se aprobó o no y su número de referencia.
        </p>
        <p>
          No te pedimos datos sensibles (salud, orientación sexual, origen étnico, creencias,
          biometría, etc.). Te pedimos no incluirlos en los mensajes ni en las reseñas.
        </p>

        <h2><span class="sec-num">03</span> Para qué los usamos</h2>
        <ul>
          <li>Crear, cobrar, preparar y enviar tus pedidos, y enviarte por correo la confirmación de compra.</li>
          <li>Coordinar la entrega contigo y con la transportadora, y atender cambios, garantías y reclamos.</li>
          <li>Responder tus cotizaciones y mensajes, y conversar contigo sobre tu proyecto.</li>
          <li>Publicar tu reseña en el sitio, solo después de revisarla y aprobarla.</li>
          <li>Validar los códigos de descuento y evitar que se usen más veces de las permitidas.</li>
          <li>Prevenir fraudes y proteger el sitio, la tienda y a nuestros clientes.</li>
          <li>Entender cómo se usa el sitio para mejorarlo (solo si aceptaste las cookies de análisis).</li>
          <li>Cumplir nuestras obligaciones contables, tributarias y legales.</li>
        </ul>
        <p>
          <strong>No vendemos tus datos ni los usamos para enviarte publicidad sin tu permiso.</strong>
          Si algún día queremos escribirte con novedades o promociones, te pediremos una autorización
          aparte y podrás retirarla cuando quieras.
        </p>

        <h2><span class="sec-num">04</span> Por qué podemos usarlos</h2>
        <p>
          Usamos tus datos porque nos diste tu autorización previa, expresa e informada: al marcar las
          casillas de autorización en el checkout o al enviar un formulario después de conocer esta
          política. Algunos datos, como los de las facturas y los pedidos, también los conservamos
          porque la ley nos obliga a hacerlo.
        </p>

        <h2><span class="sec-num">05</span> Con quién los compartimos</h2>
        <p>
          Para que el sitio y la tienda funcionen nos apoyamos en proveedores que tratan datos por
          cuenta nuestra (encargados). Cada uno recibe solo lo necesario para su tarea:
        </p>
        <ul>
          <li><strong>Bold</strong> (Colombia): procesa los pagos.</li>
          <li><strong>Empresas de transporte:</strong> reciben tu nombre, celular y dirección para entregar el pedido.</li>
          <li><strong>Supabase:</strong> aloja nuestra base de datos, donde guardamos pedidos, cotizaciones, mensajes y reseñas.</li>
          <li><strong>Resend:</strong> envía los correos de confirmación de compra y los avisos internos de pedidos y mensajes.</li>
          <li><strong>Google</strong> (Firebase Hosting, Google Analytics y Google Fonts): aloja el sitio, mide su uso si lo aceptaste y sirve las tipografías. Al cargar las tipografías tu navegador envía tu dirección IP a Google.</li>
        </ul>
        <p>
          Algunos de estos proveedores tienen sus servidores fuera de Colombia, principalmente en
          Estados Unidos. Por eso tus datos pueden almacenarse en otros países. Cuando eso pasa,
          exigimos que se protejan con un nivel de seguridad y confidencialidad equivalente al que
          exige la ley colombiana.
        </p>
        <p>
          También entregaremos datos a una autoridad cuando una ley o una orden judicial lo exija.
        </p>

        <h2><span class="sec-num">06</span> Cuánto tiempo los guardamos</h2>
        <ul>
          <li><strong>Pedidos y pagos:</strong> durante el tiempo que exigen las normas comerciales, contables y tributarias, que puede ser de hasta diez años.</li>
          <li><strong>Cotizaciones:</strong> hasta dos años desde nuestro último contacto, o mientras dure el proyecto que contrates.</li>
          <li><strong>Mensajes:</strong> hasta dos años desde que los recibimos.</li>
          <li><strong>Reseñas:</strong> mientras estén publicadas, o hasta que nos pidas retirarlas.</li>
          <li><strong>Datos de análisis:</strong> según la configuración de retención de Google Analytics, que es como máximo de 14 meses.</li>
        </ul>
        <p>
          Pasados esos plazos, eliminamos los datos o los volvemos anónimos.
        </p>

        <h2><span class="sec-num">07</span> Lo que se guarda en tu navegador</h2>
        <p>
          Algunos datos no salen de tu dispositivo: el carrito de compras y tu decisión sobre las
          cookies se guardan en el almacenamiento local de tu navegador. Mientras haces una compra, el
          formulario del checkout y el pedido en curso se guardan temporalmente en esa pestaña para
          que no pierdas nada si recargas la página; se borran al cerrarla. Las casillas de
          autorización nunca se guardan: las marcas tú cada vez.
        </p>
        <p>
          Google Analytics solo se carga si lo aceptas en el aviso de cookies. Los detalles están en
          nuestra <a routerLink="/cookies">Política de cookies</a>.
        </p>

        <h2><span class="sec-num">08</span> Tus reseñas públicas</h2>
        <p>
          Si dejas una reseña y la aprobamos, publicaremos tu nombre, tu cargo o empresa (si lo
          diste) y tu comentario. <strong>Tu correo nunca se publica</strong>: solo lo usamos para
          contactarte sobre tu reseña. Puedes pedirnos que la retiremos o la corrijamos en cualquier
          momento.
        </p>

        <h2><span class="sec-num">09</span> Cómo protegemos tus datos</h2>
        <ul>
          <li>Todo el sitio funciona sobre una conexión cifrada (HTTPS).</li>
          <li>La base de datos tiene reglas de acceso que impiden a los visitantes leer los datos de otras personas.</li>
          <li>Solo las personas del equipo que los necesitan pueden ver tus datos, y entran con verificación en dos pasos.</li>
          <li>Los pagos se hacen en la ventana segura de Bold, sin que los datos de pago pasen por nuestros sistemas.</li>
        </ul>
        <p>
          Ningún sistema es totalmente infalible. Si ocurriera un incidente que afecte tus datos, te
          lo informaremos y lo reportaremos a la Superintendencia de Industria y Comercio, como manda
          la ley.
        </p>

        <h2><span class="sec-num">10</span> Menores de edad</h2>
        <p>
          El sitio y la tienda están dirigidos a personas mayores de edad. Si eres menor de 18 años,
          pídele a tu madre, padre o representante legal que haga la compra o envíe el formulario por
          ti. Si nos damos cuenta de que recibimos datos de un menor sin esa autorización, los
          eliminaremos.
        </p>

        <h2><span class="sec-num">11</span> Tus derechos</h2>
        <p>Como titular de tus datos puedes, en cualquier momento y sin costo:</p>
        <ul>
          <li>Conocer, actualizar y corregir tus datos.</li>
          <li>Pedir prueba de la autorización que nos diste.</li>
          <li>Preguntar para qué hemos usado tus datos.</li>
          <li>Retirar tu autorización y pedir que borremos tus datos, salvo los que la ley nos obligue a conservar.</li>
          <li>Presentar quejas ante la Superintendencia de Industria y Comercio (SIC), después de haber acudido a nosotros.</li>
        </ul>
        <p>
          Escríbenos a <a href="mailto:hola@cuacdesign.com">hola&#64;cuacdesign.com</a> con el asunto
          <strong>“Habeas data”</strong>. Respondemos las consultas en un máximo de 10 días hábiles y
          los reclamos en un máximo de 15 días hábiles. El procedimiento completo está en la
          <a routerLink="/tratamiento-datos">Política de tratamiento de datos personales</a>.
        </p>

        <h2><span class="sec-num">12</span> Cambios a esta política</h2>
        <p>
          Si cambiamos esta política de forma importante, lo avisaremos en el sitio y, si nos has
          comprado, también por correo, antes de que el cambio empiece a aplicar. La versión vigente
          siempre estará en <a routerLink="/privacidad">cuacdesign.com/privacidad</a>, con su fecha de
          actualización arriba.
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
      description: 'Qué datos recoge Cuac Design en su sitio y en la tienda Cuaquiverso, para qué los usa, con quién los comparte y cómo puedes controlarlos.',
      canonical: 'https://cuacdesign.com/privacidad',
    });
  }
}
