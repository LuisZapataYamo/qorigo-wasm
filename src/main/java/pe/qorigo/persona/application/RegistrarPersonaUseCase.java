package pe.qorigo.persona.application;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import pe.qorigo.persona.domain.NombreNormalizador;
import pe.qorigo.persona.domain.Persona;
import pe.qorigo.shared.application.AuditoriaPort;
import pe.qorigo.shared.application.Reloj;
import pe.qorigo.shared.domain.ConflictoException;
import pe.qorigo.shared.domain.ValidacionException;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@ApplicationScoped
public class RegistrarPersonaUseCase {

    @Inject
    PersonaRepository personas;

    @Inject
    Reloj reloj;

    @Inject
    AuditoriaPort auditoria;

    @Transactional
    public Persona ejecutar(RegistrarPersonaCommand command) {
        String nombres = textoObligatorio(command.nombres(), "nombres", "Los nombres son obligatorios");
        String apellidos = textoObligatorio(command.apellidos(), "apellidos", "Los apellidos son obligatorios");
        String documento = textoOpcional(command.documento());
        String email = textoOpcional(command.email());

        if (documento != null) {
            Optional<Persona> existente = personas.buscarPorDocumento(documento);
            if (existente.isPresent()) {
                throw new ConflictoException("DOCUMENTO_DUPLICADO",
                        "Ya existe una persona con el documento " + documento,
                        Map.of("idPersonaExistente", String.valueOf(existente.get().idPersona())));
            }
        }

        String normalizado = NombreNormalizador.nombreCompleto(nombres, apellidos);
        List<Persona> similares = personas.buscarSimilares(normalizado);
        if (!similares.isEmpty() && !command.confirmarDuplicado()) {
            String ids = similares.stream()
                    .map(p -> String.valueOf(p.idPersona()))
                    .collect(Collectors.joining(","));
            throw new ConflictoException("POSIBLE_DUPLICADO",
                    "Existe una persona con nombres y apellidos similares",
                    Map.of("idsPersonasSimilares", ids));
        }

        Persona persona = new Persona(
                null,
                nombres,
                apellidos,
                normalizado,
                documento,
                textoOpcional(command.telefono()),
                email,
                textoOpcional(command.direccion()),
                true,
                reloj.ahora());

        Persona guardada = personas.guardar(persona);
        auditoria.registrar("PERSONA", guardada.idPersona(), "CREAR", null, guardada);
        return guardada;
    }

    private String textoObligatorio(String valor, String campo, String mensaje) {
        if (valor == null || valor.isBlank()) {
            throw new ValidacionException(campo, mensaje);
        }
        return valor.trim();
    }

    private String textoOpcional(String valor) {
        return valor == null || valor.isBlank() ? null : valor.trim();
    }
}
