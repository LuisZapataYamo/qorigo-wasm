package pe.qorigo.persona.application;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import pe.qorigo.persona.domain.Persona;
import pe.qorigo.shared.domain.NoEncontradoException;

@ApplicationScoped
public class ObtenerPersonaUseCase {

    @Inject
    PersonaRepository personas;

    @Transactional
    public Persona ejecutar(Long idPersona) {
        return personas.buscarPorId(idPersona)
                .orElseThrow(() -> new NoEncontradoException("Persona", idPersona));
    }
}
