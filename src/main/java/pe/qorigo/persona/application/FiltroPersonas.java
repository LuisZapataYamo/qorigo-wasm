package pe.qorigo.persona.application;

/**
 * Filtro de búsqueda de personas ya normalizado por el caso de uso.
 *
 * @param nombreNormalizado texto sin tildes ni mayúsculas para buscar por nombre
 * @param texto             texto original para buscar por documento o correo
 */
public record FiltroPersonas(
        String nombreNormalizado,
        String texto,
        Boolean activo,
        int pagina,
        int tamano
) {
    public int desplazamiento() {
        return (pagina - 1) * tamano;
    }
}
