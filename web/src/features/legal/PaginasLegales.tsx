import { Link } from 'react-router-dom'
import { H2, P, PaginaLegal, UL } from './PaginaLegal'
import { RESPONSABLE } from './responsable'

/** Cómo contactar: usa el correo del responsable si ya está configurado. */
function Contacto() {
  return RESPONSABLE.correo ? (
    <>
      escribiendo a <a className="font-semibold underline" href={`mailto:${RESPONSABLE.correo}`}>{RESPONSABLE.correo}</a>
    </>
  ) : (
    <>desde Configuración → «Eliminar mi cuenta» dentro de la app</>
  )
}

export function PaginaPrivacidad() {
  return (
    <PaginaLegal titulo="Aviso de privacidad">
      <P>
        Este aviso explica qué datos personales trata Bazaria, para qué y cómo puedes ejercer tus derechos, conforme a la Ley
        Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP).
      </P>

      <H2>1. Responsable</H2>
      <P>
        <b>{RESPONSABLE.nombre}</b>, persona física que opera Bazaria, con domicilio en {RESPONSABLE.domicilio}, es
        responsable del tratamiento de tus datos personales. Contacto de privacidad:{' '}
        <a className="font-semibold underline" href={`mailto:${RESPONSABLE.correo}`}>{RESPONSABLE.correo}</a>.
      </P>

      <H2>2. Datos que recabamos</H2>
      <UL>
        <li>
          <b>Al iniciar sesión con Google:</b> tu correo electrónico, tu nombre de perfil y un identificador único de tu cuenta
          de Google. No recibimos ni vemos tu contraseña de Google.
        </li>
        <li>
          <b>Lo que tú capturas:</b> lotes (nombre, costo, piezas, fecha), prendas (tipo, color, talla, marca, estado, costos y
          precios), ventas (precio, envío, comisión, canal) y las fotos de tus prendas.
        </li>
        <li>
          <b>Datos técnicos:</b> dirección IP, navegador y dispositivo (user agent), la dirección de la página que se pidió,
          fecha y hora, y los errores del servicio. Se guardan en registros del servidor para seguridad y diagnóstico. No
          incluyen tu contraseña ni tu sesión.
        </li>
      </UL>
      <UL>
        <li>
          <b>Datos de uso:</b> cuántas prendas, fotos y espacio ocupa tu cuenta, y en su caso cuántas funciones de pago usas.
          Se calculan a partir de lo que ya guardas; no rastreamos lo que haces dentro de la app.
        </li>
      </UL>
      <P>
        No solicitamos datos personales sensibles ni datos de tarjetas o cuentas bancarias. Las fotos se procesan en el
        servidor: se convierten a un formato más ligero y se les elimina la información de ubicación y de cámara (metadatos
        EXIF).
      </P>

      <H2>3. Para qué usamos tus datos</H2>
      <P>Finalidades necesarias para el servicio:</P>
      <UL>
        <li>Crear y mantener tu cuenta y reconocerte cuando entras.</li>
        <li>Guardar tu inventario y calcular costos, ganancias y reportes que ves en la app.</li>
        <li>Mantener la seguridad del servicio, prevenir abusos y hacer respaldos.</li>
        <li>Darte soporte cuando nos escribes y corregir errores.</li>
        <li>Medir cuánto se usa el servicio (espacio y funciones) para planear su capacidad y sus costos.</li>
      </UL>
      <P>
        <b>No</b> usamos tus datos para publicidad, perfilamiento, analítica de comportamiento ni mercadotecnia, y no los
        vendemos. Por eso no hay finalidades secundarias que puedas aceptar o rechazar.
      </P>

      <H2>4. Dónde se guardan y con quién se comparten</H2>
      <P>
        No vendemos tus datos ni los transferimos a terceros para fines propios de ellos. Para operar el servicio intervienen
        estos proveedores, que tratan datos solo por nuestra cuenta (encargados):
      </P>
      <UL>
        <li>
          <b>Contabo GmbH (servidor en Francia, Unión Europea):</b> aloja la base de datos, las fotos, los registros técnicos y
          los respaldos más recientes. Por eso tus datos se almacenan fuera de México.
        </li>
        <li>
          <b>Cloudflare, Inc. (Estados Unidos, red global):</b> entrega la página web y la aplicación y protege la conexión.
          Por su red pasan tus solicitudes cifradas.
        </li>
        <li>
          <b>Google LLC (Estados Unidos):</b> autenticación cuando eliges iniciar sesión con tu cuenta de Google, y
          almacenamiento de los respaldos en Google Drive. Los respaldos van cifrados antes de salir de nuestro servidor: Google
          guarda los archivos pero no puede leerlos.
        </li>
      </UL>
      <P>
        Hoy Bazaria <b>no</b> envía tus fotos ni tus datos a ningún servicio de inteligencia artificial. Si en el futuro se
        activa alguna función de ese tipo (por ejemplo, reconocer una prenda por su foto o quitarle el fondo), será opcional,
        te diremos qué proveedor se usa y actualizaremos este aviso antes de activarla.
      </P>
      <P>Podremos revelar datos si una autoridad competente lo exige conforme a la ley.</P>

      <H2>5. Quién puede ver tus datos</H2>
      <UL>
        <li>Tú, desde la app, con tu sesión.</li>
        <li>
          El responsable y, en su caso, colaboradores autorizados con acceso de <b>solo lectura</b> a un panel de
          administración. Lo usan únicamente para dar soporte, mantener la seguridad, corregir errores y medir el uso del
          servicio, y están obligados a guardar confidencialidad. No pueden modificar tu información.
        </li>
        <li>Ninguna otra usuaria de Bazaria puede ver tus lotes, prendas, ventas ni fotos.</li>
      </UL>

      <H2>6. Tus derechos (ARCO)</H2>
      <P>
        Tienes derecho a Acceder a tus datos, Rectificarlos, Cancelarlos y Oponerte a su tratamiento, así como a revocar tu
        consentimiento. Puedes ejercerlos <Contacto />, indicando tu nombre, el derecho que deseas ejercer, una descripción de
        los datos involucrados y una copia de una identificación oficial. Te responderemos en los plazos que marca la ley.
        Si consideras que tu derecho a la protección de datos fue vulnerado, puedes acudir a la autoridad competente en
        materia de protección de datos personales.
      </P>
      <UL>
        <li><b>Rectificar:</b> edita tus lotes y prendas directamente en la app.</li>
        <li><b>Cancelar:</b> usa «Eliminar mi cuenta» en Configuración. Tu acceso se bloquea de inmediato.</li>
        <li><b>Acceder y portar:</b> puedes exportar tu inventario a Excel desde la sección Inventario.</li>
      </UL>

      <H2>7. Cuánto tiempo conservamos tus datos</H2>
      <UL>
        <li>Mientras tu cuenta esté activa.</li>
        <li>
          En tu dispositivo se guarda una copia de tu inventario para que funcione sin conexión. Se elimina al cerrar sesión; si
          hay cambios sin subir, la app te avisa antes de cerrarla.
        </li>
        <li>
          Al eliminar tu cuenta damos <b>30 días de gracia</b>: si vuelves a iniciar sesión en ese plazo, tu cuenta se
          reactiva. Pasado el plazo, tus datos y fotos se borran de forma definitiva.
        </li>
        <li>Las copias de respaldo pueden conservar los datos hasta 14 días adicionales antes de eliminarse.</li>
        <li>
          Registros técnicos: los de errores se borran a los 7 días y los de acceso al servidor se conservan hasta 90 días.
        </li>
      </UL>

      <H2>8. Seguridad</H2>
      <P>
        La comunicación va cifrada (HTTPS), cada usuaria solo puede acceder a sus propios datos y la sesión se identifica con
        un token que puedes cerrar en cualquier momento. La base de datos no es accesible desde internet, se respalda todos
        los días y el panel de administración tiene contraseña propia con bloqueo ante intentos fallidos.
      </P>
      <P>
        <b>Sobre tus fotos:</b> solo se abren con un enlace firmado que la app recibe con tu sesión y que caduca en unos
        días. Un enlace copiado deja de funcionar al caducar, y sin la firma no abre. Las copias de respaldo se guardan
        cifradas: sin la clave, que solo tiene el responsable de Bazaria, no se pueden abrir.
      </P>
      <P>
        Ningún sistema es infalible; si detectamos una vulneración que afecte tus datos, te lo haremos saber.
      </P>

      <H2>9. Menores de edad</H2>
      <P>Bazaria no está dirigido a menores de 18 años y no recabamos datos de menores de forma intencional.</P>

      <H2>10. Cambios a este aviso</H2>
      <P>
        Si cambia este aviso, publicaremos la versión nueva en esta página con su fecha de actualización. Consulta también
        nuestros <Link className="font-semibold underline" to="/terminos">Términos</Link> y la{' '}
        <Link className="font-semibold underline" to="/cookies">política de cookies</Link>.
      </P>
    </PaginaLegal>
  )
}

export function PaginaTerminos() {
  return (
    <PaginaLegal titulo="Términos y condiciones">
      <P>
        Al usar Bazaria aceptas estos términos. Si no estás de acuerdo, por favor no uses el servicio.
      </P>

      <H2>1. Qué es Bazaria</H2>
      <P>
        Una aplicación web para que quienes venden ropa u otros artículos de bazar lleven su inventario, repartan el costo de
        una paca o lote entre sus piezas y vean cuánto ganan por venta. El uso de la aplicación es <b>gratuito</b>. En el
        futuro podrían existir funciones opcionales de pago (por ejemplo, reconocer artículos por foto o quitar el fondo);
        si las hay, se ofrecerán por separado, con su precio y condiciones claros antes de contratarlas.
      </P>

      <H2>2. Tu cuenta</H2>
      <UL>
        <li>Entras con tu cuenta de Google. Eres responsable de lo que se haga con tu sesión.</li>
        <li>Debes ser mayor de edad y darnos información veraz.</li>
        <li>Puedes eliminar tu cuenta cuando quieras desde Configuración.</li>
      </UL>

      <H2>3. Tu información es tuya</H2>
      <P>
        Los datos y fotos que capturas siguen siendo tuyos. Nos autorizas únicamente a almacenarlos y procesarlos para
        prestarte el servicio, como se explica en el <Link className="font-semibold underline" to="/privacidad">Aviso de privacidad</Link>.
        Garantizas que tienes derecho a subir las fotos que cargas.
      </P>

      <H2>4. Cómo manejamos tu información (resumen)</H2>
      <P>
        El detalle completo está en el <Link className="font-semibold underline" to="/privacidad">Aviso de privacidad</Link>;
        en corto:
      </P>
      <UL>
        <li>
          <b>Qué guardamos:</b> tu correo y nombre de Google, lo que capturas (lotes, prendas, ventas y fotos) y registros
          técnicos de seguridad.
        </li>
        <li>
          <b>Dónde:</b> en un servidor de Contabo en Francia, y una copia en tu dispositivo para usar la app sin conexión.
        </li>
        <li>
          <b>Quién lo ve:</b> tú; y el responsable o colaboradores autorizados con acceso de solo lectura, únicamente para
          soporte, seguridad y medir el uso, con obligación de confidencialidad. Ninguna otra usuaria.
        </li>
        <li>
          <b>Qué no hacemos:</b> no vendemos tus datos, no los usamos para publicidad y hoy no los enviamos a servicios de
          inteligencia artificial.
        </li>
        <li>
          <b>Tus fotos:</b> se les quita la ubicación y los datos de la cámara, y solo se abren con un enlace firmado que
          caduca. Los respaldos se guardan cifrados.
        </li>
        <li>
          <b>Cuánto tiempo:</b> mientras tengas tu cuenta. Si la eliminas, tienes 30 días para arrepentirte; después se borra
          todo de forma definitiva, y las copias de respaldo desaparecen en máximo 14 días más.
        </li>
        <li>
          <b>Tu control:</b> puedes exportar tu inventario a Excel, corregir tus datos en la app y eliminar tu cuenta desde
          Configuración.
        </li>
      </UL>

      <H2>5. Uso aceptable y límites</H2>
      <UL>
        <li>No uses el servicio para actividades ilegales ni para subir contenido que infrinja derechos de terceros.</li>
        <li>No intentes acceder a datos de otras personas, vulnerar la seguridad ni sobrecargar el servicio.</li>
        <li>Podemos suspender cuentas que incumplan estos términos.</li>
        <li>
          <b>Espacio para fotos:</b> cada cuenta gratuita puede guardar hasta <b>500 MB de fotos</b> (unas 5,000 fotos
          tomadas con el celular). Las fotos repetidas, por ejemplo al duplicar una prenda, no cuentan. Si llegas al límite,
          lo que captures se queda guardado en tu teléfono y se sube cuando liberes espacio borrando prendas que ya no
          necesites.
        </li>
        <li>
          <b>Velocidad de subida:</b> puedes subir hasta <b>300 fotos nuevas por hora</b>. Si te pasas, las demás se suben
          solas un rato después.
        </li>
        <li>
          Los planes de pago, si llegan a existir, pueden tener límites mayores, que se informarán al contratarlos. Si
          reducimos algún límite lo avisaremos con anticipación, y nunca borraremos por eso fotos que ya tengas guardadas.
        </li>
      </UL>

      <H2>6. Los cálculos son informativos</H2>
      <P>
        Los costos, ganancias y reportes que muestra Bazaria son una ayuda para tu control del negocio. No constituyen
        asesoría contable, fiscal ni legal, y no sustituyen tu contabilidad ni tus obligaciones ante el SAT.
      </P>

      <H2>7. Disponibilidad y garantías</H2>
      <P>
        Hacemos lo posible por mantener el servicio disponible y respaldar tu información, pero se ofrece «tal cual», sin
        garantía de disponibilidad continua ni de ausencia de errores. El servicio puede detenerse unos minutos por
        mantenimiento programado; lo que captures en ese momento se guarda en tu dispositivo y se sube al volver. Te recomendamos exportar tu inventario a Excel de vez
        en cuando como respaldo propio.
      </P>

      <H2>8. Limitación de responsabilidad</H2>
      <P>
        En la medida permitida por la ley, no somos responsables de pérdidas indirectas, de ganancias no obtenidas ni de
        decisiones de negocio tomadas con base en la información de la app.
      </P>

      <H2>9. Código abierto y servicio alojado</H2>
      <P>
        El código de Bazaria se distribuye bajo licencia MIT: puedes usarlo, modificarlo e instalarlo por tu cuenta. Estos
        términos regulan el uso del servicio alojado en example.com. Si deseas una instalación propia alojada en nuestros
        servidores, tiene un costo que se acuerda por separado: escríbenos a{' '}
        <a className="font-semibold underline" href={`mailto:${RESPONSABLE.correo}`}>{RESPONSABLE.correo}</a>.
      </P>

      <H2>10. Cambios</H2>
      <P>
        Podemos actualizar estos términos. La versión vigente es la publicada en esta página; seguir usando Bazaria después de
        un cambio implica que lo aceptas.
      </P>

      <H2>11. Ley aplicable</H2>
      <P>
        Estos términos se rigen por las leyes de los Estados Unidos Mexicanos. Para su interpretación y cumplimiento, las
        partes se someten a los tribunales competentes del domicilio del responsable, en Guadalupe, Nuevo León.
      </P>
    </PaginaLegal>
  )
}

export function PaginaCookies() {
  return (
    <PaginaLegal titulo="Política de cookies">
      <P>
        Bazaria usa únicamente cookies y almacenamiento del navegador <b>estrictamente necesarios</b> para funcionar. No usamos
        cookies de publicidad, de analítica ni de seguimiento, por lo que no hay nada que aceptar o rechazar.
      </P>

      <H2>Qué guardamos y para qué</H2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-black/15 dark:border-white/20">
              <th className="py-2 pr-4">Nombre</th>
              <th className="py-2 pr-4">Tipo</th>
              <th className="py-2 pr-4">Para qué sirve</th>
              <th className="py-2">Duración</th>
            </tr>
          </thead>
          <tbody className="align-top">
            <tr className="border-b border-black/10 dark:border-white/10">
              <td className="py-2 pr-4 font-mono">bazaria_oauth_state, bazaria_oauth_verifier</td>
              <td className="py-2 pr-4">Cookie (api.example.com)</td>
              <td className="py-2 pr-4">Protegen el inicio de sesión con Google contra falsificaciones. Son HttpOnly.</td>
              <td className="py-2">10 minutos</td>
            </tr>
            <tr className="border-b border-black/10 dark:border-white/10">
              <td className="py-2 pr-4 font-mono">bazar_api_token</td>
              <td className="py-2 pr-4">Almacenamiento local</td>
              <td className="py-2 pr-4">Mantiene tu sesión iniciada.</td>
              <td className="py-2">Hasta que cierres sesión o 30 días</td>
            </tr>
            <tr className="border-b border-black/10 dark:border-white/10">
              <td className="py-2 pr-4 font-mono">bazar_tema, bazar_skin, bazaria-vocabulario</td>
              <td className="py-2 pr-4">Almacenamiento local</td>
              <td className="py-2 pr-4">Recuerdan tu modo claro/oscuro, tu estilo visual y si usas el modo neutro (artículos en vez de prendas).</td>
              <td className="py-2">Hasta que lo borres</td>
            </tr>
            <tr className="border-b border-black/10 dark:border-white/10">
              <td className="py-2 pr-4 font-mono">bazaria-datos</td>
              <td className="py-2 pr-4">Base de datos local (IndexedDB)</td>
              <td className="py-2 pr-4">Guarda en tu dispositivo una copia de tu inventario y los cambios que hiciste sin conexión, para poder usar Bazaria sin señal y subirlos después. Se borra al cerrar sesión.</td>
              <td className="py-2">Hasta que cierres sesión o la borres</td>
            </tr>
            <tr className="border-b border-black/10 dark:border-white/10">
              <td className="py-2 pr-4 font-mono">bazaria-fotos</td>
              <td className="py-2 pr-4">Caché del navegador (service worker)</td>
              <td className="py-2 pr-4">Guarda las fotos de tus prendas para verlas sin conexión.</td>
              <td className="py-2">Hasta 60 días o hasta que la borres</td>
            </tr>
            <tr className="border-b border-black/10 dark:border-white/10">
              <td className="py-2 pr-4 font-mono">bazaria_aviso_cookies</td>
              <td className="py-2 pr-4">Almacenamiento local</td>
              <td className="py-2 pr-4">Recuerda que ya viste el aviso de cookies.</td>
              <td className="py-2">Hasta que lo borres</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-mono">Caché de la app</td>
              <td className="py-2 pr-4">Service worker</td>
              <td className="py-2 pr-4">Permite que Bazaria cargue rápido y se pueda instalar como app.</td>
              <td className="py-2">Hasta que se actualice o la borres</td>
            </tr>
          </tbody>
        </table>
      </div>

      <H2>Cómo borrarlas</H2>
      <P>
        Cerrar sesión elimina el token de tu sesión. También puedes borrar los datos del sitio desde la configuración de tu
        navegador. Si lo haces, tendrás que volver a iniciar sesión.
      </P>

      <H2>Terceros</H2>
      <P>
        Al iniciar sesión, Google puede usar sus propias cookies en accounts.google.com según su política. Bazaria no controla
        esas cookies. Más datos en el <Link className="font-semibold underline" to="/privacidad">Aviso de privacidad</Link>.
      </P>
    </PaginaLegal>
  )
}
