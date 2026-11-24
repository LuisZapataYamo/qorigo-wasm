package pe.qorigo.catalogo.application;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import pe.qorigo.catalogo.domain.Plataforma;
import pe.qorigo.shared.application.AuditoriaPort;
import pe.qorigo.shared.domain.ConflictoException;
import pe.qorigo.shared.domain.ValidacionException;

import java.util.Map;

@ApplicationScoped
public class CrearPlataformaUseCase {

    @Inject
    CatalogoRepository catalogo;

    @Inject
    AuditoriaPort auditoria;

    @Transactional
    public Plataforma ejecutar(String nombre, String descripcion) {
        String nombreLimpio = obligatorio(nombre);
        if (catalogo.buscarPlataformaPorNombre(nombreLimpio).isPresent()) {
            throw new ConflictoException("PLATAFORMA_DUPLICADA", "Ya existe una plataforma con ese nombre");
        }
        Plataforma guardada = catalogo.guardarPlataforma(new Plataforma(null, nombreLimpio, opcional(descripcion), true));
        auditoria.registrar("PLATAFORMA", guardada.idPlataforma(), "CREAR", null, guardada);
        return guardada;
    }

    private String obligatorio(String valor) {
        if (valor == null || valor.isBlank()) {
            throw new ValidacionException("nombre", "El nombre es obligatorio");
        }
        return valor.trim();
    }

    private String opcional(String valor) {
        return valor == null || valor.isBlank() ? null : valor.trim();
    }
}
