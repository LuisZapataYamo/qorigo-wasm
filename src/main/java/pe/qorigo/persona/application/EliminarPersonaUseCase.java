package pe.qorigo.persona.application;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import pe.qorigo.persona.domain.Persona;
import pe.qorigo.shared.application.AuditoriaPort;
import pe.qorigo.shared.domain.ConflictoException;
import pe.qorigo.shared.domain.NoEncontradoException;

@ApplicationScoped
public class EliminarPersonaUseCase {

    @Inject
    PersonaRepository personas;

    @Inject
    AuditoriaPort auditoria;

    @Transactional
    public void ejecutar(Long idPersona) {
        Persona persona = personas.buscarPorId(idPersona)
                .orElseThrow(() -> new NoEncontradoException("Persona", idPersona));

        if (personas.tieneMovimientos(idPersona)) {
            throw new ConflictoException("PERSONA_CON_MOVIMIENTOS",
                    "La persona tiene movimientos registrados. Desactívala para conservar el historial");
        }
        if (personas.tieneUsuario(idPersona)) {
            throw new ConflictoException("PERSONA_CON_ACCESO",
                    "La persona tiene un usuario de acceso. Desactívala para conservar el historial");
        }

        auditoria.registrar("PERSONA", idPersona, "ELIMINAR", persona, null);
        personas.eliminar(idPersona);
    }
}
