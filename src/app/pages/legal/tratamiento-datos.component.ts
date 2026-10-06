import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TopbarComponent } from '../../layout/topbar/topbar.component';
import { FooterComponent } from '../../layout/footer/footer.component';
import { SeoService } from '../../core/services/seo.service';

/**
 * Política de tratamiento de la información exigida por el art. 17 lit. k de la
 * Ley 1581 de 2012 y el art. 2.2.2.25.3.1 del Decreto 1074 de 2015. Es la que
 * autoriza el comprador en la primera casilla del checkout.
 *
 * Ese artículo pide identificar al responsable con nombre o razón social,
 * domicilio, dirección, correo y teléfono: la sección 01 debe completarse con
 * los datos reales cuando estén definidos.
 */
@Component({
  selector: 'app-tratamiento-datos',
  standalone: true,
  imports: [RouterLink, TopbarComponent, FooterComponent],
  template: `
    <app-topbar />
    <main class="legal-page">
      <div class="legal-hero">
        <span class="eyebrow">Legal</span>
        <h1>Política de tratamiento de datos personales</h1>
        <p class="updated">Vigente desde el 5 de octubre de 2026</p>
      </div>
      <div class="legal-body">

        <p>
          Esta política cumple la <strong>Ley Estatutaria 1581 de 2012</strong>, el Decreto 1074 de
          2015 (Capítulo 25, que incorpora el Decreto 1377 de 2013) y demás normas que los modifiquen
          o complementen. Establece cómo Cuac Design recolecta, almacena, usa, circula y suprime los
          datos personales de sus clientes, posibles clientes, visitantes y colaboradores. Una
          explicación más sencilla está en nuestra <a routerLink="/privacidad">Política de privacidad</a>.
        </p>

        <h2><span class="sec-num">01</span> Responsable del tratamiento</h2>
        <ul>
          <li><strong>Nombre:</strong> Cuac Design</li>
          <li><strong>Domicilio:</strong> Bogotá D.C., Colombia</li>
          <li><strong>Correo electrónico:</strong> <a href="mailto:hola@cuacdesign.com">hola&#64;cuacdesign.com</a></li>
          <li><strong>Sitio web:</strong> <a routerLink="/">cuacdesign.com</a></li>
        </ul>

        <h2><span class="sec-num">02</span> Definiciones</h2>
        <ul>
          <li><strong>Autorización:</strong> consentimiento previo, expreso e informado del titular para el tratamiento de sus datos.</li>
          <li><strong>Dato personal:</strong> cualquier información vinculada o que pueda asociarse a una persona natural determinada o determinable.</li>
          <li><strong>Dato sensible:</strong> el que afecta la intimidad del titular o cuyo uso indebido puede generar discriminación, como el origen racial o étnico, la orientación política, las convicciones religiosas, los datos de salud, de vida sexual o biométricos.</li>
          <li><strong>Titular:</strong> la persona natural cuyos datos son objeto de tratamiento.</li>
          <li><strong>Tratamiento:</strong> cualquier operación sobre datos personales, como recolección, almacenamiento, uso, circulación o supresión.</li>
          <li><strong>Responsable:</strong> quien decide sobre la base de datos y el tratamiento; en este caso, Cuac Design.</li>
          <li><strong>Encargado:</strong> quien trata datos por cuenta del responsable, como nuestros proveedores tecnológicos.</li>
          <li><strong>Transferencia:</strong> envío de datos a un receptor que a su vez es responsable del tratamiento.</li>
          <li><strong>Transmisión:</strong> comunicación de datos a un encargado para que los trate por cuenta del responsable, dentro o fuera de Colombia.</li>
        </ul>

        <h2><span class="sec-num">03</span> Principios</h2>
        <p>
          Tratamos los datos según los principios de legalidad, finalidad, libertad, veracidad o
          calidad, transparencia, acceso y circulación restringida, seguridad y confidencialidad del
          artículo 4 de la Ley 1581 de 2012. En la práctica, esto significa que solo pedimos los datos
          necesarios para cada finalidad, no los usamos para algo distinto de lo que informamos, y los
          protegemos mientras estén en nuestro poder.
        </p>

        <h2><span class="sec-num">04</span> Datos que tratamos y finalidades</h2>

        <p><strong>Clientes de la tienda Cuaquiverso</strong></p>
        <p>
          Datos: nombre, apellido, correo electrónico, celular, tipo y número de documento de
          identidad, departamento, ciudad, dirección, barrio, código postal, notas del pedido,
          productos comprados, valores, códigos de descuento, referencia y estado del pago.
        </p>
        <ul>
          <li>Crear, cobrar, preparar, despachar y entregar los pedidos.</li>
          <li>Enviar la confirmación de la compra y comunicaciones sobre el estado del pedido.</li>
          <li>Atender peticiones, quejas, reclamos, cambios, devoluciones y garantías.</li>
          <li>Validar códigos de descuento y controlar su uso.</li>
          <li>Prevenir y detectar fraudes.</li>
          <li>Emitir facturas y cumplir obligaciones contables, tributarias y legales.</li>
        </ul>

        <p><strong>Posibles clientes (cotizador)</strong></p>
        <p>
          Datos: nombre, correo electrónico, empresa, teléfono (opcional), servicios de interés,
          descripción del proyecto, presupuesto, plazo y resultado del estimador.
        </p>
        <ul>
          <li>Preparar y enviar cotizaciones, y contactar al titular sobre su proyecto.</li>
          <li>Ejecutar el contrato de servicios si el titular lo contrata.</li>
        </ul>

        <p><strong>Personas que nos escriben o dejan reseñas</strong></p>
        <p>
          Datos: tipo de mensaje y su contenido; en las reseñas, nombre, cargo o empresa (opcional),
          comentario; y en ambos casos el correo, si el titular decide dejarlo.
        </p>
        <ul>
          <li>Leer y responder mensajes, sugerencias y comentarios.</li>
          <li>Publicar en el sitio, previa revisión, el nombre, el cargo o empresa y el comentario de las reseñas. El correo nunca se publica.</li>
        </ul>

        <p><strong>Visitantes del sitio</strong></p>
        <p>
          Solo si el visitante acepta las cookies de análisis: datos de navegación agregados
          (páginas visitadas, duración, dispositivo, navegador y ubicación aproximada) recogidos por
          Google Analytics.
        </p>
        <ul>
          <li>Medir el uso del sitio y mejorar su contenido y funcionamiento.</li>
        </ul>

        <p><strong>Equipo y colaboradores</strong></p>
        <p>
          Datos: nombre, correo electrónico y, en el punto de venta de eventos, el nombre asignado al
          dispositivo, su sistema operativo, navegador, tamaño de pantalla y fechas de uso.
        </p>
        <ul>
          <li>Dar acceso seguro a las herramientas internas y saber desde qué dispositivo se registró cada venta.</li>
        </ul>

        <p>
          Cuac Design no usará los datos para enviar publicidad o mercadeo sin una autorización
          separada y específica del titular, y no los venderá ni los cederá a terceros con fines
          comerciales.
        </p>

        <h2><span class="sec-num">05</span> Autorización</h2>
        <p>
          La autorización se obtiene antes de recoger los datos, por medios que permiten su consulta
          posterior. En el checkout, el titular la otorga al marcar las casillas de aceptación de esta
          política y de la Política de privacidad; sin ellas no es posible completar la compra. En los
          demás formularios, la otorga al enviarlos después de haber conocido estas políticas.
        </p>
        <p>
          Conforme al artículo 10 de la Ley 1581 de 2012, no se requiere autorización para datos de
          naturaleza pública, para casos de urgencia médica o sanitaria, para fines históricos,
          estadísticos o científicos, ni cuando la información la solicite una entidad pública en
          ejercicio de sus funciones o por orden judicial.
        </p>

        <h2><span class="sec-num">06</span> Datos sensibles y de menores de edad</h2>
        <p>
          Cuac Design no solicita datos sensibles. Si fuera necesario hacerlo, se informará al titular
          que no está obligado a entregarlos y se pedirá su autorización explícita. Recomendamos no
          incluir datos sensibles en los mensajes ni en las reseñas.
        </p>
        <p>
          Nuestros servicios están dirigidos a mayores de edad. Los datos de niños, niñas y
          adolescentes solo se tratarán con autorización de su representante legal, respetando su
          interés superior y sus derechos fundamentales. Si detectamos datos de un menor obtenidos sin
          esa autorización, los suprimiremos.
        </p>

        <h2><span class="sec-num">07</span> Derechos de los titulares</h2>
        <p>Según el artículo 8 de la Ley 1581 de 2012, el titular tiene derecho a:</p>
        <ul>
          <li>Conocer, actualizar y rectificar sus datos personales, incluidos los parciales, inexactos, incompletos, fraccionados o que induzcan a error.</li>
          <li>Solicitar prueba de la autorización otorgada, salvo cuando la ley no la exija.</li>
          <li>Ser informado, previa solicitud, sobre el uso que se ha dado a sus datos.</li>
          <li>Presentar quejas ante la Superintendencia de Industria y Comercio por infracciones a la ley, después de haber agotado el trámite de consulta o reclamo ante Cuac Design.</li>
          <li>Revocar la autorización y solicitar la supresión de sus datos cuando no se respeten los principios, derechos y garantías legales. La supresión no procede cuando el titular tenga un deber legal o contractual de permanecer en la base de datos.</li>
          <li>Acceder en forma gratuita a sus datos personales.</li>
        </ul>
        <p>
          Estos derechos pueden ejercerlos el titular, acreditando su identidad; sus causahabientes;
          su representante o apoderado, acreditando la representación; o quien se haya estipulado a
          favor de otro.
        </p>

        <h2><span class="sec-num">08</span> Deberes de Cuac Design</h2>
        <p>
          Como responsable, Cuac Design cumple los deberes del artículo 17 de la Ley 1581 de 2012.
          Entre ellos están garantizar al titular el ejercicio de su derecho de hábeas data, conservar
          la información en condiciones de seguridad, mantenerla actualizada y exacta, tramitar las
          consultas y reclamos en los plazos legales, exigir a sus encargados el respeto de la
          seguridad y privacidad de la información, e informar a la Superintendencia de Industria y
          Comercio cualquier violación a los códigos de seguridad que ponga en riesgo los datos.
        </p>

        <h2><span class="sec-num">09</span> Área responsable de atender consultas y reclamos</h2>
        <p>
          El equipo de Cuac Design atiende las solicitudes de los titulares en el correo
          <a href="mailto:hola@cuacdesign.com">hola&#64;cuacdesign.com</a>. Para agilizar el trámite,
          escribe en el asunto <strong>“Habeas data”</strong> e incluye tu nombre completo, tu número
          de documento, el correo o celular con el que nos diste tus datos, una descripción de lo que
          solicitas y, si aplica, los documentos que quieras hacer valer.
        </p>

        <h2><span class="sec-num">10</span> Procedimiento para consultas</h2>
        <p>
          Puedes consultar los datos que tenemos sobre ti. Responderemos en un máximo de
          <strong>diez (10) días hábiles</strong> desde que recibamos la consulta. Si no es posible
          hacerlo en ese plazo, te informaremos el motivo y la fecha de respuesta, que no superará
          cinco (5) días hábiles adicionales.
        </p>

        <h2><span class="sec-num">11</span> Procedimiento para reclamos</h2>
        <p>
          Si consideras que tus datos deben corregirse, actualizarse o suprimirse, o que hemos
          incumplido la ley, puedes presentar un reclamo:
        </p>
        <ol>
          <li>Si el reclamo está incompleto, te pediremos dentro de los cinco (5) días hábiles siguientes que lo completes. Si pasan dos (2) meses sin que lo hagas, entenderemos que desististe.</li>
          <li>Una vez recibido el reclamo completo, marcaremos tus datos con la leyenda “reclamo en trámite” en un máximo de dos (2) días hábiles, hasta que se resuelva.</li>
          <li>Responderemos en un máximo de <strong>quince (15) días hábiles</strong> desde el día siguiente a su recepción. Si no es posible hacerlo en ese plazo, te informaremos el motivo y la fecha de respuesta, que no superará ocho (8) días hábiles adicionales.</li>
        </ol>
        <p>
          Si recibimos un reclamo que no nos corresponde resolver, lo trasladaremos a quien
          corresponda en un máximo de dos (2) días hábiles y te lo informaremos.
        </p>

        <h2><span class="sec-num">12</span> Encargados y transmisión internacional</h2>
        <p>
          Para prestar nuestros servicios transmitimos datos a encargados que los tratan por nuestra
          cuenta y bajo nuestras instrucciones: Bold (procesamiento de pagos, Colombia), empresas de
          transporte (entrega de pedidos), Supabase (base de datos), Resend (envío de correos) y
          Google (alojamiento del sitio, analítica y tipografías). Varios de ellos tienen servidores
          fuera de Colombia, principalmente en Estados Unidos.
        </p>
        <p>
          Con la autorización a esta política, el titular acepta esta transmisión internacional, que
          se hace en los términos del artículo 2.2.2.25.5.2 del Decreto 1074 de 2015. Exigimos a los
          encargados medidas de seguridad y confidencialidad adecuadas y que usen los datos solo para
          las finalidades aquí descritas.
        </p>

        <h2><span class="sec-num">13</span> Seguridad de la información</h2>
        <p>
          Aplicamos medidas técnicas, humanas y administrativas para proteger los datos contra
          adulteración, pérdida, consulta, uso o acceso no autorizado o fraudulento. Entre ellas:
          cifrado de las comunicaciones (HTTPS), reglas de acceso en la base de datos que impiden a
          terceros consultar información de otros titulares, acceso del equipo limitado a quien lo
          necesita y protegido con verificación en dos pasos, y procesamiento de pagos en la
          plataforma de Bold sin que los datos de las tarjetas pasen por nuestros sistemas.
        </p>

        <h2><span class="sec-num">14</span> Conservación</h2>
        <p>
          Conservamos los datos solo el tiempo necesario para cumplir las finalidades informadas y las
          obligaciones legales. Los datos de pedidos y pagos se conservan durante el término que
          exigen las normas comerciales, contables y tributarias (hasta diez años); los de cotizaciones
          y mensajes, hasta dos años desde el último contacto; y las reseñas, mientras estén
          publicadas o hasta que el titular pida retirarlas. Cumplidos estos plazos, los datos se
          suprimen o se anonimizan.
        </p>

        <h2><span class="sec-num">15</span> Vigencia y cambios</h2>
        <p>
          Esta política rige desde el 5 de octubre de 2026. Las bases de datos estarán vigentes
          mientras Cuac Design desarrolle su actividad y durante los plazos de conservación
          indicados. Cualquier cambio sustancial se comunicará en el sitio y, a los clientes, por
          correo, antes de su aplicación. Si un cambio afecta las finalidades, pediremos una nueva
          autorización.
        </p>

      </div>
    </main>
    <app-footer />
  `,
})
export class TratamientoDatosComponent implements OnInit {
  private seo = inject(SeoService);

  ngOnInit(): void {
    this.seo.set({
      title: 'Política de tratamiento de datos personales — Cuac Design',
      description: 'Política de tratamiento de datos personales de Cuac Design conforme a la Ley 1581 de 2012: finalidades, derechos del titular y procedimiento para consultas y reclamos.',
      canonical: 'https://cuacdesign.com/tratamiento-datos',
    });
  }
}
