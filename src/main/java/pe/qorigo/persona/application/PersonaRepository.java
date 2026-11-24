package pe.qorigo.persona.application;

import pe.qorigo.persona.domain.Persona;
import pe.qorigo.shared.application.Pagina;

import java.util.List;
import java.util.Optional;

public interface PersonaRepository {

    Optional<Persona> buscarPorId(Long idPersona);

    Optional<Persona> buscarPorDocumento(String documento);

    List<Persona> buscarSimilares(String nombreNormalizado);

    Pagina<Persona> buscar(FiltroPersonas filtro);

    boolean tieneMovimientos(Long idPersona);

    boolean tieneUsuario(Long idPersona);

    Persona guardar(Persona persona);

    void eliminar(Long idPersona);
}
