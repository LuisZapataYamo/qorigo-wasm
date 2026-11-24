package pe.qorigo.persona.application;

import pe.qorigo.persona.domain.Persona;

import java.util.Optional;

public interface PersonaRepository {

    Optional<Persona> buscarPorId(Long idPersona);

    Optional<Persona> buscarPorDocumento(String documento);

    Persona guardar(Persona persona);
}
