package pe.qorigo.persona.application;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import pe.qorigo.persona.domain.NombreNormalizador;
import pe.qorigo.persona.domain.Persona;
import pe.qorigo.shared.application.Pagina;
import pe.qorigo.shared.domain.ValidacionException;

import java.util.Locale;

@ApplicationScoped
public class ListarPersonasUseCase {

    private static final int TAMANO_MAXIMO = 100;

    @Inject
    PersonaRepository personas;

    @Transactional
    public Pagina<Persona> ejecutar(String q, String estado, int pagina, int tamano) {
        if (pagina < 1) {
            throw new ValidacionException("pagina", "La página debe ser mayor o igual a 1");
        }
        if (tamano < 1 || tamano > TAMANO_MAXIMO) {
            throw new ValidacionException("tamano", "El tamaño debe estar entre 1 y " + TAMANO_MAXIMO);
        }

        String texto = q == null || q.isBlank() ? null : q.trim();
        String normalizado = texto == null ? null : NombreNormalizador.normalizar(texto);
        Boolean activo = interpretarEstado(estado);

        return personas.buscar(new FiltroPersonas(normalizado, texto, activo, pagina, tamano));
    }

    private Boolean interpretarEstado(String estado) {
        if (estado == null || estado.isBlank() || "TODOS".equalsIgnoreCase(estado)) {
            return null;
        }
        return switch (estado.trim().toUpperCase(Locale.ROOT)) {
            case "ACTIVO", "ACTIVOS" -> Boolean.TRUE;
            case "INACTIVO", "INACTIVOS" -> Boolean.FALSE;
            default -> throw new ValidacionException("estado", "El estado debe ser ACTIVO, INACTIVO o TODOS");
        };
    }
}
