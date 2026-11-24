package pe.qorigo.catalogo.application;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

import java.util.Map;

@ApplicationScoped
public class ObtenerConfiguracionUseCase {

    @Inject
    CatalogoRepository catalogo;

    @Transactional
    public Map<String, String> ejecutar() {
        return catalogo.configuracion();
    }
}
