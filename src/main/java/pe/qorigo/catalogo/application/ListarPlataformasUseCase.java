package pe.qorigo.catalogo.application;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import pe.qorigo.catalogo.domain.Plataforma;

import java.util.List;

@ApplicationScoped
public class ListarPlataformasUseCase {

    @Inject
    CatalogoRepository catalogo;

    @Transactional
    public List<Plataforma> ejecutar(boolean incluirInactivas) {
        return catalogo.plataformas(!incluirInactivas);
    }
}
