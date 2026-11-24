package pe.qorigo.auth.application;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import pe.qorigo.auth.domain.Usuario;
import pe.qorigo.persona.application.PersonaRepository;
import pe.qorigo.persona.domain.Persona;
import pe.qorigo.shared.domain.NoAutorizadoException;

import java.util.Optional;

@ApplicationScoped
public class AutenticarUseCase {

    @Inject
    UsuarioRepository usuarios;

    @Inject
    PersonaRepository personas;

    @Inject
    PasswordHasher passwordHasher;

    @Inject
    LoginAttemptService intentos;

    @Inject
    EmisorToken emisorToken;

    public SesionIniciada ejecutar(String email, String password) {
        intentos.verificarPermitido(email);

        Optional<Usuario> encontrado = usuarios.buscarPorEmail(email);
        boolean valido = encontrado.isPresent()
                && encontrado.get().puedeIniciarSesion()
                && passwordHasher.verifica(password, encontrado.get().passwordHash());

        if (!valido) {
            intentos.registrarFallo(email);
            throw new NoAutorizadoException("Credenciales inválidas");
        }

        Usuario usuario = encontrado.get();
        intentos.registrarExito(email);

        Persona persona = personas.buscarPorId(usuario.idPersona()).orElse(null);
        UsuarioSesion sesion = new UsuarioSesion(
                usuario.idUsuario(),
                usuario.idPersona(),
                usuario.emailLogin(),
                usuario.rol(),
                persona == null ? null : persona.nombres(),
                persona == null ? null : persona.apellidos());

        EmisorToken.TokenEmitido token = emisorToken.emitir(usuario);
        return new SesionIniciada(token.token(), token.expiraEn(), sesion);
    }
}
