package com.wayfinding.indoor.service;

import com.wayfinding.indoor.dto.NavigationRecalculateRequest;
import com.wayfinding.indoor.dto.NavigationRequest;
import com.wayfinding.indoor.dto.NavigationResponse;
import com.wayfinding.indoor.model.NavigationNode;
import com.wayfinding.indoor.repository.NavigationNodeRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NavigationServiceTest {

    @Mock
    private NavigationNodeRepository nodeRepository;

    @InjectMocks
    private NavigationService navigationService;

    @Test
    void computeRoute_returnsPathWithDestination() {
        NavigationNode n1 = new NavigationNode("n1", "F1", 0, 0, List.of("n2"), null, "waypoint");
        NavigationNode n2 = new NavigationNode("n2", "F1", 5, 0, List.of("n1", "n3"), null, "waypoint");
        NavigationNode n3 = new NavigationNode("n3", "F1", 10, 0, List.of("n2"), null, "waypoint");

        when(nodeRepository.findByFloorId("F1")).thenReturn(List.of(n1, n2, n3));

        NavigationRequest request = new NavigationRequest();
        request.setFloorId("F1");
        request.setStartX(0);
        request.setStartY(0);
        request.setDestX(10);
        request.setDestY(0);

        NavigationResponse response = navigationService.computeRoute(request);

        assertThat(response.isSuccess()).isTrue();
        assertThat(response.getRoute()).isNotEmpty();
        assertThat(response.getRoute().get(response.getRoute().size() - 1).getX()).isEqualTo(10);
        assertThat(response.getRoute().get(response.getRoute().size() - 1).getY()).isEqualTo(0);
    }

    @Test
    void recalculateIfDeviated_keepsRouteWhenOnPath() {
        NavigationRecalculateRequest request = new NavigationRecalculateRequest();
        request.setFloorId("F1");
        request.setCurrentX(5);
        request.setCurrentY(0.5);
        request.setDestX(10);
        request.setDestY(0);
        request.setDeviationThreshold(10.0);

        NavigationRecalculateRequest.RoutePointInput p1 = new NavigationRecalculateRequest.RoutePointInput();
        p1.setX(0);
        p1.setY(0);
        p1.setType("start");

        NavigationRecalculateRequest.RoutePointInput p2 = new NavigationRecalculateRequest.RoutePointInput();
        p2.setX(10);
        p2.setY(0);
        p2.setType("destination");

        request.setPreviousRoute(Arrays.asList(p1, p2));

        NavigationResponse response = navigationService.recalculateIfDeviated(request);

        assertThat(response.getMessage()).contains("On route");
        assertThat(response.getRoute().get(0).getX()).isEqualTo(5);
        assertThat(response.getRoute().get(0).getY()).isEqualTo(0.5);
    }
}
