package pe.qorigo.catalogo.application;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import pe.qorigo.catalogo.domain.Moneda;

import java.util.List;

@ApplicationScoped
public class ListarMonedasUseCase {

    @Inject
    CatalogoRepository catalogo;

    @Transactional
    public List<Moneda> ejecutar() {
        return catalogo.monedas();
    }
}
