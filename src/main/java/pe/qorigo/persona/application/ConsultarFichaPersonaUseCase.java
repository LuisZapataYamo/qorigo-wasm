package pe.qorigo.persona.application;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import pe.qorigo.persona.domain.Persona;
import pe.qorigo.shared.domain.NoEncontradoException;

@ApplicationScoped
public class ConsultarFichaPersonaUseCase {

    @Inject
    PersonaRepository personas;

    @Inject
    PersonaFichaRepository fichaRepository;

    @Transactional
    public FichaPersona ejecutar(Long idPersona) {
        Persona persona = personas.buscarPorId(idPersona)
                .orElseThrow(() -> new NoEncontradoException("Persona", idPersona));
        FichaMovimientos movimientos = fichaRepository.obtener(idPersona);
        return new FichaPersona(
                persona,
                movimientos.suscripciones(),
                movimientos.prestamos(),
                movimientos.deudaPorMoneda(),
                movimientos.pagosRecientes());
    }
}
