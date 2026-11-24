package pe.qorigo.auth.infrastructure;

import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;
import pe.qorigo.auth.application.SeedAdminUseCase;

@ApplicationScoped
public class AdminSeeder {

    private static final Logger LOG = Logger.getLogger(AdminSeeder.class);

    @Inject
    SeedAdminUseCase seedAdmin;

    void alIniciar(@Observes StartupEvent event) {
        try {
            seedAdmin.ejecutar();
        } catch (RuntimeException e) {
            LOG.error("No se pudo crear el usuario administrador inicial", e);
        }
    }
}
