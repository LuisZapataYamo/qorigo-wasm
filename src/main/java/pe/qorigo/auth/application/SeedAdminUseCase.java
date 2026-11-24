package pe.qorigo.auth.application;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import pe.qorigo.auth.domain.Rol;
import pe.qorigo.auth.domain.Usuario;
import pe.qorigo.persona.application.PersonaRepository;
import pe.qorigo.persona.domain.NombreNormalizador;
import pe.qorigo.persona.domain.Persona;
import pe.qorigo.shared.application.AuditoriaPort;
import pe.qorigo.shared.application.Reloj;

import java.util.Map;

@ApplicationScoped
public class SeedAdminUseCase {

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

    @ConfigProperty(name = "qorigo.seed-admin.enabled", defaultValue = "false")
    boolean habilitado;

    @ConfigProperty(name = "qorigo.seed-admin.email", defaultValue = "admin@qorigo.local")
    String email;

    @ConfigProperty(name = "qorigo.seed-admin.password", defaultValue = "Admin123!")
    String password;

    @ConfigProperty(name = "qorigo.seed-admin.nombres", defaultValue = "Administrador")
    String nombres;

    @ConfigProperty(name = "qorigo.seed-admin.apellidos", defaultValue = "QoriGo")
    String apellidos;

    @Transactional
    public void ejecutar() {
        if (!habilitado || usuarios.buscarPorEmail(email).isPresent()) {
            return;
        }
        Persona persona = personas.guardar(new Persona(
                null,
                nombres,
                apellidos,
                NombreNormalizador.nombreCompleto(nombres, apellidos),
                null,
                null,
                email,
                null,
                true,
                reloj.ahora()));

        Usuario usuario = usuarios.guardar(new Usuario(
                null,
                persona.idPersona(),
                email.toLowerCase(),
                passwordHasher.hash(password),
                Rol.ADMIN,
                true,
                reloj.ahora()));

        auditoria.registrar("USUARIO", usuario.idUsuario(), "SEED_ADMIN", null,
                Map.of("email", email.toLowerCase()));
    }
}
