package pe.qorigo.auth.application;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import pe.qorigo.auth.domain.Rol;
import pe.qorigo.auth.domain.Usuario;
import pe.qorigo.persona.application.PersonaRepository;
import pe.qorigo.persona.domain.Persona;
import pe.qorigo.shared.application.AuditoriaPort;
import pe.qorigo.shared.application.Reloj;
import pe.qorigo.shared.domain.ConflictoException;
import pe.qorigo.shared.domain.NoEncontradoException;

import java.util.Map;

@ApplicationScoped
public class CrearAccesoPersonaUseCase {

    @Inject
    UsuarioRepository usuarios;

    @Inject
    PersonaRepository personas;

    @Inject
    PasswordHasher passwordHasher;

    @Inject
    Reloj reloj;

    @Inject
    AuditoriaPort auditoria;

    @Transactional
    public UsuarioSesion ejecutar(Long idPersona, String email, String password, String rol) {
        Persona persona = personas.buscarPorId(idPersona)
                .orElseThrow(() -> new NoEncontradoException("Persona", idPersona));

        if (usuarios.buscarPorPersona(idPersona).isPresent()) {
            throw new ConflictoException("USUARIO_EXISTENTE", "La persona ya tiene un usuario de acceso");
        }
        String emailNormalizado = email == null ? "" : email.trim().toLowerCase();
        if (usuarios.existeEmail(emailNormalizado)) {
            throw new ConflictoException("EMAIL_EN_USO", "El correo ya está registrado");
        }

        Usuario usuario = new Usuario(
                null,
                idPersona,
                emailNormalizado,
                passwordHasher.hash(password),
                Rol.desde(rol),
                true,
                reloj.ahora());
        Usuario guardado = usuarios.guardar(usuario);

        auditoria.registrar("USUARIO", guardado.idUsuario(), "CREAR", null,
                Map.of("idPersona", idPersona, "email", emailNormalizado, "rol", guardado.rol().name()));

        return new UsuarioSesion(
                guardado.idUsuario(),
                guardado.idPersona(),
                guardado.emailLogin(),
                guardado.rol(),
                persona.nombres(),
                persona.apellidos());
    }
}
