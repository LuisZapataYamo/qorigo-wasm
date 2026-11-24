package pe.qorigo.catalogo.application;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import pe.qorigo.catalogo.domain.Plataforma;
import pe.qorigo.shared.application.AuditoriaPort;
import pe.qorigo.shared.domain.ConflictoException;
import pe.qorigo.shared.domain.NoEncontradoException;
import pe.qorigo.shared.domain.ValidacionException;

import java.util.Objects;

@ApplicationScoped
public class ActualizarPlataformaUseCase {

    @Inject
    CatalogoRepository catalogo;

    @Inject
    AuditoriaPort auditoria;

    @Transactional
    public Plataforma ejecutar(Long idPlataforma, String nombre, String descripcion, Boolean activo) {
        Plataforma actual = catalogo.buscarPlataforma(idPlataforma)
                .orElseThrow(() -> new NoEncontradoException("Plataforma", idPlataforma));

        String nombreFinal = nombre == null ? actual.nombre() : obligatorio(nombre);
        if (!Objects.equals(nombreFinal, actual.nombre())) {
            catalogo.buscarPlataformaPorNombre(nombreFinal).ifPresent(otra -> {
                throw new ConflictoException("PLATAFORMA_DUPLICADA", "Ya existe una plataforma con ese nombre");
            });
        }
        Plataforma actualizada = new Plataforma(
                actual.idPlataforma(),
                nombreFinal,
                descripcion == null ? actual.descripcion() : opcional(descripcion),
                activo == null ? actual.activo() : activo);

        if (actualizada.equals(actual)) {
            return actual;
        }
        Plataforma guardada = catalogo.guardarPlataforma(actualizada);
        auditoria.registrar("PLATAFORMA", idPlataforma,
                Boolean.FALSE.equals(activo) ? "DESACTIVAR" : "ACTUALIZAR", actual, guardada);
        return guardada;
    }

    private String obligatorio(String valor) {
        if (valor.isBlank()) {
            throw new ValidacionException("nombre", "El nombre es obligatorio");
        }
        return valor.trim();
    }

    private String opcional(String valor) {
        return valor.isBlank() ? null : valor.trim();
    }
}
