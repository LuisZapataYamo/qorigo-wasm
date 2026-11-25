export function EnConstruccion({
  titulo,
  caso,
}: {
  titulo: string;
  caso: string;
}) {
  return (
    <section className="pagina">
      <div className="pagina-encabezado">
        <h1>{titulo}</h1>
        <p>Este módulo corresponde a {caso}.</p>
      </div>
      <article className="tarjeta">
        <p>Se implementará en la siguiente rama del plan.</p>
      </article>
    </section>
  );
}
