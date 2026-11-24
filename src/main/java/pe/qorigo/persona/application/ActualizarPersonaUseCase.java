package pe.qorigo.persona.application;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import pe.qorigo.persona.domain.NombreNormalizador;
import pe.qorigo.persona.domain.Persona;
import pe.qorigo.shared.application.AuditoriaPort;
import pe.qorigo.shared.domain.ConflictoException;
import pe.qorigo.shared.domain.NoEncontradoException;
import pe.qorigo.shared.domain.ValidacionException;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@ApplicationScoped
public class ActualizarPersonaUseCase {

    @Inject
    PersonaRepository personas;

    @Inject
    AuditoriaPort auditoria;

    @Transactional
    public Persona ejecutar(Long idPersona, ActualizarPersonaCommand command) {
        Persona actual = personas.buscarPorId(idPersona)
                .orElseThrow(() -> new NoEncontradoException("Persona", idPersona));

        String nombres = command.nombres() == null
                ? actual.nombres()
                : obligatorio(command.nombres(), "nombres", "Los nombres son obligatorios");
        String apellidos = command.apellidos() == null
                ? actual.apellidos()
                : obligatorio(command.apellidos(), "apellidos", "Los apellidos son obligatorios");
        String documento = command.documento() == null
                ? actual.documento()
                : opcional(command.documento());

        if (documento != null && !Objects.equals(documento, actual.documento())) {
            personas.buscarPorDocumento(documento).ifPresent(otra -> {
                throw new ConflictoException("DOCUMENTO_DUPLICADO",
                        "Ya existe una persona con el documento " + documento,
                        Map.of("idPersonaExistente", String.valueOf(otra.idPersona())));
            });
        }

        boolean cambioNombre = !nombres.equals(actual.nombres()) || !apellidos.equals(actual.apellidos());
        String normalizado = cambioNombre ? NombreNormalizador.nombreCompleto(nombres, apellidos) : actual.nombreNormalizado();
        if (cambioNombre) {
            verificarSimilares(idPersona, normalizado, command.confirmarDuplicado());
        }

        Persona actualizada = new Persona(
                actual.idPersona(),
                nombres,
                apellidos,
                normalizado,
                documento,
                command.telefono() == null ? actual.telefono() : opcional(command.telefono()),
                command.email() == null ? actual.email() : opcional(command.email()),
                command.direccion() == null ? actual.direccion() : opcional(command.direccion()),
                command.activo() == null ? actual.activo() : command.activo(),
                actual.creadoEn());

        if (actualizada.equals(actual)) {
            return actual;
        }

        Persona guardada = personas.guardar(actualizada);
        auditoria.registrar("PERSONA", idPersona, accion(actual, guardada), actual, guardada);
        return guardada;
    }

    private void verificarSimilares(Long idPersona, String normalizado, boolean confirmarDuplicado) {
        if (confirmarDuplicado) {
            return;
        }
        List<Persona> similares = personas.buscarSimilares(normalizado).stream()
                .filter(persona -> !persona.idPersona().equals(idPersona))
                .toList();
        if (!similares.isEmpty()) {
            String ids = similares.stream()
                    .map(persona -> String.valueOf(persona.idPersona()))
                    .collect(Collectors.joining(","));
            throw new ConflictoException("POSIBLE_DUPLICADO",
                    "Existe una persona con nombres y apellidos similares",
                    Map.of("idsPersonasSimilares", ids));
        }
    }

    private String accion(Persona antes, Persona despues) {
        if (antes.activo() && !despues.activo()) {
            return "DESACTIVAR";
        }
        if (!antes.activo() && despues.activo()) {
            return "ACTIVAR";
        }
        return "ACTUALIZAR";
    }

    private String obligatorio(String valor, String campo, String mensaje) {
        if (valor.isBlank()) {
            throw new ValidacionException(campo, mensaje);
        }
        return valor.trim();
    }

    private String opcional(String valor) {
        return valor.isBlank() ? null : valor.trim();
    }
}
