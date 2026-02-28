from django.shortcuts import render

# Create your views here.
from rest_framework import status, generics
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.decorators import api_view, permission_classes
import requests

from .serializers import RegisterSerializer, LoginSerializer, UserSerializer


class RegisterView(generics.CreateAPIView):
    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'user': UserSerializer(user).data,
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        }, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [AllowAny]
    
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        
        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'user': UserSerializer(user).data,
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        })


class UserProfileView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = UserSerializer
    
    def get_object(self):
        return self.request.user


@api_view(['POST'])
@permission_classes([AllowAny])
def predict_breakage(request):
    """
    Endpoint to predict pipeline breakage using ML service
    """
    try:
        flow_1 = request.data.get('flow_1')
        pressure_1 = request.data.get('pressure_1')
        flow_2 = request.data.get('flow_2')
        pressure_2 = request.data.get('pressure_2')
        
        if None in [flow_1, pressure_1, flow_2, pressure_2]:
            return Response({
                'error': 'Missing required fields: flow_1, pressure_1, flow_2, pressure_2'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        ml_service_url = 'http://localhost:8001/predict'
        response = requests.post(ml_service_url, json={
            'flow_1': float(flow_1),
            'pressure_1': float(pressure_1),
            'flow_2': float(flow_2),
            'pressure_2': float(pressure_2)
        }, timeout=5)
        
        response.raise_for_status()
        prediction_data = response.json()
        
        return Response({
            'success': True,
            'prediction': prediction_data
        }, status=status.HTTP_200_OK)
        
    except requests.exceptions.RequestException as e:
        return Response({
            'error': 'ML service unavailable',
            'details': str(e)
        }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        
    except Exception as e:
        return Response({
            'error': 'Internal server error',
            'details': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

from .models import Workspace, WorkspaceInvite, Gateway
from .serializers import WorkspaceSerializer

class OnboardingView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = request.data

        workspace = Workspace.objects.create(
            owner=request.user,
            company_name=data.get('companyName', ''),
            company_type=data.get('companyType', ''),
            location=data.get('location', ''),
            team_size=data.get('teamSize', ''),
            modules=data.get('modules', []),
            gateway_id=data.get('gatewayId', ''),
            threshold_soil_moisture=data.get('thresholds', {}).get('soilMoisture', [20, 80]),
            threshold_ph=data.get('thresholds', {}).get('ph', [6, 8]),
            threshold_pressure=data.get('thresholds', {}).get('pressure', [2, 6]),
            notifications=data.get('notifications', []),
            status='active',
        )

        for email in data.get('inviteEmails', []):
            WorkspaceInvite.objects.create(
                workspace=workspace,
                email=email,
            )

        gateway_id = data.get('gatewayId', '').strip()
        if gateway_id:
            Gateway.objects.create(
                id=gateway_id,
                workspace=workspace,
            )

        return Response({
            'success': True,
            'workspace_id': str(workspace.id),
        }, status=status.HTTP_201_CREATED)

    def get(self, request):
        workspace = Workspace.objects.filter(owner=request.user).first()
        if not workspace:
            return Response({'exists': False})
        return Response({
            'exists': True,
            'workspace': WorkspaceSerializer(workspace).data,
        })
